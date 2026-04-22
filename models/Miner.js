const mongoose = require('mongoose');

const BeneficialOwnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  idNumber: {
    type: String,
    required: true,
    trim: true
  },
  percentageOwnership: {
    type: Number,
    required: true,
    min: 25,
    max: 100
  }
});

const MinerSchema = new mongoose.Schema({
  // Personal & Identity Information
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function(value) {
        const age = new Date().getFullYear() - value.getFullYear();
        return age >= 18 && age <= 100;
      },
      message: 'Applicant must be between 18 and 100 years old'
    }
  },
  nationalId: {
    type: String,
    required: [true, 'National ID/Passport number is required'],
    trim: true,
    unique: true,
    match: [/^[0-9]{2}-[0-9]{6}[A-Z][0-9]{2}$/, 'Invalid Zimbabwean ID format']
  },
  nationality: {
    type: String,
    required: [true, 'Nationality is required'],
    default: 'Zimbabwean',
    enum: ['Zimbabwean', 'Other']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^\+263[0-9]{9}$/, 'Invalid Zimbabwean phone number format']
  },
  emailAddress: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email format']
  },
  physicalAddress: {
    type: String,
    required: [true, 'Physical address is required'],
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters']
  },

  // Licensing & Registration
  minerCategory: {
    type: String,
    required: [true, 'Miner category is required'],
    enum: [
      'Individual Licence',
      'Cooperative',
      'Company',
      'Syndicate',
      'Diamond Dealer'
    ]
  },
  miningLicenceNo: {
    type: String,
    required: [true, 'Mining licence number is required'],
    trim: true,
    unique: true
  },
  fgrRegistrationNo: {
    type: String,
    trim: true,
    sparse: true
  },
  mmcRegistrationNo: {
    type: String,
    trim: true,
    sparse: true
  },
  primaryOperatingArea: {
    type: String,
    required: [true, 'Primary operating area is required'],
    enum: [
      'Mashonaland Central',
      'Mashonaland West', 
      'Mashonaland East',
      'Midlands',
      'Manicaland',
      'Matabeleland South',
      'Matabeleland North',
      'Bulawayo',
      'Harare'
    ]
  },
  primaryMineral: {
    type: String,
    required: [true, 'Primary mineral is required'],
    enum: ['Gold', 'Diamond', 'Platinum', 'Silver', 'Other']
  },

  // Beneficial Ownership
  operatingAs: {
    type: String,
    required: [true, 'Operating structure is required'],
    enum: ['Individual (sole operator)', 'Entity', 'Partnership']
  },
  beneficialOwners: [BeneficialOwnerSchema],

  // Risk Indicators
  pepStatus: {
    type: String,
    required: [true, 'PEP status is required'],
    enum: ['Not a PEP', 'PEP - Domestic', 'PEP - Foreign', 'PEP - International Organisation']
  },
  highRiskArea: {
    type: String,
    required: [true, 'High-risk area status is required'],
    enum: ['No', 'Yes - Border area', 'Yes - Conflict zone', 'Yes - High crime area']
  },
  additionalRiskNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Risk notes cannot exceed 500 characters']
  },

  // System Fields
  registrationDate: {
    type: Date,
    default: Date.now
  },
  registrationStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Under Review'],
    default: 'Pending'
  },
  complianceScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
MinerSchema.index({ registrationStatus: 1 });
MinerSchema.index({ registrationDate: -1 });

// Virtual for age
MinerSchema.virtual('age').get(function() {
  return new Date().getFullYear() - this.dateOfBirth.getFullYear();
});

// Pre-save middleware to update lastUpdated
MinerSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Miner', MinerSchema);
