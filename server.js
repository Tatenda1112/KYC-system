const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Miner = require('./models/Miner');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many registration attempts, please try again later.'
});
app.use('/api/register', limiter);

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema for Authentication
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['admin', 'compliance_officer', 'miner'] },
  fullName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Create hardcoded admin account
const createAdminAccount = async () => {
  try {
    const existingAdmin = await User.findOne({ email: 'tatendatatenda1112@gmail.com' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('Tatendamukono1112@', 10);
      const admin = new User({
        email: 'tatendatatenda1112@gmail.com',
        password: hashedPassword,
        role: 'admin',
        fullName: 'Admin User'
      });
      await admin.save();
      console.log('Admin account created successfully');
    }
  } catch (error) {
    console.error('Error creating admin account:', error);
  }
};

// Call the function to create admin account
createAdminAccount();

// Authentication endpoints
// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          fullName: user.fullName
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Register miner account endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, miningLicenceNo, district } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      email,
      password: hashedPassword,
      role: 'miner',
      fullName
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          id: newUser._id,
          email: newUser.email,
          role: newUser.role,
          fullName: newUser.fullName
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user profile endpoint
app.get('/api/auth/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Validation middleware
const validateRegistration = [
  // Personal Information
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Full name must be 3-100 characters'),
  
  body('dateOfBirth')
    .notEmpty().withMessage('Date of birth is required')
    .isISO8601().withMessage('Invalid date format')
    .custom((value) => {
      const age = new Date().getFullYear() - new Date(value).getFullYear();
      if (age < 18 || age > 100) {
        throw new Error('Applicant must be between 18 and 100 years old');
      }
      return true;
    }),
  
  body('nationalId')
    .trim()
    .notEmpty().withMessage('National ID is required')
    .matches(/^[0-9]{2}-[0-9]{6}[A-Z][0-9]{2}$/).withMessage('Invalid Zimbabwean ID format'),
  
  body('nationality')
    .notEmpty().withMessage('Nationality is required')
    .isIn(['Zimbabwean', 'Other']).withMessage('Invalid nationality'),
  
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+263[0-9]{9}$/).withMessage('Invalid Zimbabwean phone number format'),
  
  body('emailAddress')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid email format'),
  
  body('physicalAddress')
    .trim()
    .notEmpty().withMessage('Physical address is required')
    .isLength({ min: 10, max: 200 }).withMessage('Address must be 10-200 characters'),
  
  // Licensing Information
  body('minerCategory')
    .notEmpty().withMessage('Miner category is required')
    .isIn(['Individual Licence', 'Cooperative', 'Company', 'Syndicate', 'Diamond Dealer'])
    .withMessage('Invalid miner category'),
  
  body('miningLicenceNo')
    .trim()
    .notEmpty().withMessage('Mining licence number is required')
    .isLength({ min: 5, max: 50 }).withMessage('Licence number must be 5-50 characters'),
  
  body('primaryOperatingArea')
    .notEmpty().withMessage('Primary operating area is required')
    .isIn(['Mashonaland Central', 'Mashonaland West', 'Mashonaland East', 'Midlands', 
           'Manicaland', 'Matabeleland South', 'Matabeleland North', 'Bulawayo', 'Harare'])
    .withMessage('Invalid operating area'),
  
  body('primaryMineral')
    .notEmpty().withMessage('Primary mineral is required')
    .isIn(['Gold', 'Diamond', 'Platinum', 'Silver', 'Other'])
    .withMessage('Invalid primary mineral'),
  
  // Beneficial Ownership
  body('operatingAs')
    .notEmpty().withMessage('Operating structure is required')
    .isIn(['Individual (sole operator)', 'Entity', 'Partnership'])
    .withMessage('Invalid operating structure'),
  
  // Risk Indicators
  body('pepStatus')
    .notEmpty().withMessage('PEP status is required')
    .isIn(['Not a PEP', 'PEP - Domestic', 'PEP - Foreign', 'PEP - International Organisation'])
    .withMessage('Invalid PEP status'),
  
  body('highRiskArea')
    .notEmpty().withMessage('High-risk area status is required')
    .isIn(['No', 'Yes - Border area', 'Yes - Conflict zone', 'Yes - High crime area'])
    .withMessage('Invalid high-risk area status'),
  
  body('additionalRiskNotes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Risk notes cannot exceed 500 characters')
];

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'KYC/CDD Registration System API' });
});

// Registration endpoint
app.post('/api/register', validateRegistration, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      fullName,
      dateOfBirth,
      nationalId,
      nationality,
      phoneNumber,
      emailAddress,
      physicalAddress,
      minerCategory,
      miningLicenceNo,
      fgrRegistrationNo,
      mmcRegistrationNo,
      primaryOperatingArea,
      primaryMineral,
      operatingAs,
      beneficialOwners,
      pepStatus,
      highRiskArea,
      additionalRiskNotes
    } = req.body;

    // Check for existing national ID or mining licence
    const existingMiner = await Miner.findOne({
      $or: [
        { nationalId: nationalId },
        { miningLicenceNo: miningLicenceNo }
      ]
    });

    if (existingMiner) {
      return res.status(400).json({
        success: false,
        message: 'A miner with this National ID or Mining Licence already exists'
      });
    }

    // Calculate compliance score
    let complianceScore = 50; // Base score
    
    // Add points for low-risk indicators
    if (pepStatus === 'Not a PEP') complianceScore += 20;
    if (highRiskArea === 'No') complianceScore += 15;
    if (emailAddress) complianceScore += 5;
    if (fgrRegistrationNo) complianceScore += 5;
    if (mmcRegistrationNo) complianceScore += 5;

    // Create new miner
    const newMiner = new Miner({
      fullName,
      dateOfBirth,
      nationalId,
      nationality,
      phoneNumber,
      emailAddress,
      physicalAddress,
      minerCategory,
      miningLicenceNo,
      fgrRegistrationNo,
      mmcRegistrationNo,
      primaryOperatingArea,
      primaryMineral,
      operatingAs,
      beneficialOwners: operatingAs !== 'Individual (sole operator)' ? beneficialOwners : [],
      pepStatus,
      highRiskArea,
      additionalRiskNotes,
      complianceScore
    });

    await newMiner.save();

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Your application is under review.',
      data: {
        id: newMiner._id,
        fullName: newMiner.fullName,
        miningLicenceNo: newMiner.miningLicenceNo,
        registrationStatus: newMiner.registrationStatus,
        complianceScore: newMiner.complianceScore,
        registrationDate: newMiner.registrationDate
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// Get registration status
app.get('/api/status/:id', async (req, res) => {
  try {
    const miner = await Miner.findById(req.params.id);
    
    if (!miner) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: miner._id,
        fullName: miner.fullName,
        registrationStatus: miner.registrationStatus,
        complianceScore: miner.complianceScore,
        registrationDate: miner.registrationDate,
        lastUpdated: miner.lastUpdated
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all registrations (admin endpoint)
app.get('/api/registrations', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = status ? { registrationStatus: status } : {};
    
    const registrations = await Miner.find(filter)
      .sort({ registrationDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-beneficialOwners -additionalRiskNotes');

    const total = await Miner.countDocuments(filter);

    res.json({
      success: true,
      data: {
        registrations,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRegistrations: total
        }
      }
    });

  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
