# KYC/CDD Registration System

A comprehensive Customer Due Diligence (CDD) and Know Your Customer (KYC) registration system for Zimbabwe small-scale miners, built with Node.js, Express, MongoDB, and modern frontend technologies.

## Features

- **Comprehensive Registration Form**: Multi-section form covering personal details, licensing, beneficial ownership, and risk assessment
- **Real-time Validation**: Client-side validation with immediate feedback
- **Responsive Design**: Mobile-first design that works on all devices
- **Security Features**: Rate limiting, input sanitization, and secure data handling
- **Compliance Scoring**: Automatic calculation of compliance scores based on risk factors
- **Modern UI/UX**: Beautiful gradient design with smooth animations and transitions

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Express Validator** - Input validation
- **Helmet** - Security middleware
- **Rate Limiting** - DDoS protection

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with Tailwind CSS
- **JavaScript ES6+** - Modern JavaScript features
- **Font Awesome** - Icons
- **Responsive Design** - Mobile-first approach

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### 1. Clone the Repository
```bash
git clone <repository-url>
cd kyc-cdd-registration-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/kyc_cdd_system
JWT_SECRET=your_jwt_secret_key_here_change_in_production
NODE_ENV=development
```

### 4. Start MongoDB
Make sure MongoDB is running on your system:
```bash
# On Windows
net start MongoDB

# On macOS/Linux
sudo systemctl start mongod
```

### 5. Start the Application
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:5000`

## API Endpoints

### Registration
- **POST** `/api/register` - Submit new registration
- **GET** `/api/status/:id` - Check registration status
- **GET** `/api/registrations` - Get all registrations (admin)

### Static Files
- **GET** `/` - Registration form
- **GET** `/styles.css` - Custom styles
- **GET** `/script.js` - Frontend JavaScript

## Form Sections

### 1. Personal & Identity Information
- Full name, date of birth, national ID
- Contact information (phone, email)
- Physical address

### 2. Licensing & Registration
- Miner category and licence details
- Operating area and primary mineral
- Additional registrations (FGR, MMCZ)

### 3. Beneficial Ownership Declaration
- Operating structure (individual, entity, partnership)
- Beneficial owners with >25% ownership
- Dynamic form fields for multiple owners

### 4. Risk Indicators
- PEP (Politically Exposed Person) status
- High-risk area assessment
- Additional compliance notes

## Validation Rules

### Personal Information
- **Full Name**: 3-100 characters, required
- **Date of Birth**: Must be 18-100 years old, required
- **National ID**: Zimbabwean format (XX-XXXXXXX), required
- **Phone Number**: +263 format, required
- **Email**: Valid email format, optional
- **Address**: 10-200 characters, required

### Licensing Information
- **Miner Category**: Must select from predefined options
- **Mining Licence**: 5-50 characters, required
- **Operating Area**: Must select from Zimbabwe provinces
- **Primary Mineral**: Must select from options

### Risk Assessment
- **PEP Status**: Required selection
- **High-Risk Area**: Required selection
- **Risk Notes**: Maximum 500 characters

## Security Features

- **Rate Limiting**: 10 requests per 15 minutes per IP
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Using MongoDB ODM
- **XSS Protection**: Input sanitization and helmet middleware
- **CSRF Protection**: Built-in Express security

## Compliance Scoring

The system automatically calculates compliance scores based on:
- Base score: 50 points
- PEP Status: +20 if not a PEP
- Risk Area: +15 if not high-risk
- Email: +5 if provided
- FGR Registration: +5 if provided
- MMCZ Registration: +5 if provided

## Database Schema

### Miner Collection
```javascript
{
  fullName: String,
  dateOfBirth: Date,
  nationalId: String,
  nationality: String,
  phoneNumber: String,
  emailAddress: String,
  physicalAddress: String,
  minerCategory: String,
  miningLicenceNo: String,
  fgrRegistrationNo: String,
  mmcRegistrationNo: String,
  primaryOperatingArea: String,
  primaryMineral: String,
  operatingAs: String,
  beneficialOwners: [{
    name: String,
    idNumber: String,
    percentageOwnership: Number
  }],
  pepStatus: String,
  highRiskArea: String,
  additionalRiskNotes: String,
  registrationDate: Date,
  registrationStatus: String,
  complianceScore: Number,
  lastUpdated: Date
}
```

## Testing

### Manual Testing
1. Open `http://localhost:5000` in your browser
2. Fill out the registration form completely
3. Submit and verify success modal
4. Check database for new record

### API Testing
Use Postman or curl to test endpoints:

```bash
# Test registration endpoint
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "dateOfBirth": "1990-01-01",
    "nationalId": "90-123456A78",
    "nationality": "Zimbabwean",
    "phoneNumber": "+263771234567",
    "emailAddress": "test@example.com",
    "physicalAddress": "123 Test Street, Harare",
    "minerCategory": "Individual Licence",
    "miningLicenceNo": "ML/G/2023/00123",
    "primaryOperatingArea": "Harare",
    "primaryMineral": "Gold",
    "operatingAs": "Individual (sole operator)",
    "pepStatus": "Not a PEP",
    "highRiskArea": "No"
  }'
```

## Deployment

### Production Setup
1. Set `NODE_ENV=production` in environment
2. Use a production MongoDB instance
3. Configure reverse proxy (nginx/Apache)
4. Set up SSL certificates
5. Configure monitoring and logging

### Environment Variables
```env
PORT=5000
MONGODB_URI=mongodb://your-production-db-url
JWT_SECRET=your-secure-jwt-secret
NODE_ENV=production
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Email: support@example.com
- Documentation: Check the `/docs` folder
- Issues: Create an issue on GitHub

## Changelog

### v1.0.0
- Initial release
- Complete registration system
- Responsive design
- Security features
- Compliance scoring
- API endpoints
