// Test script for KYC/CDD Registration System
// This script can be run to test the API endpoints

const testData = {
    fullName: "Moyo, Blessing Takudzwa",
    dateOfBirth: "1985-06-15",
    nationalId: "85-123456A78",
    nationality: "Zimbabwean",
    phoneNumber: "+263771234567",
    emailAddress: "blessing.moyo@example.com",
    physicalAddress: "123 Main Street, Kadoma, Zimbabwe",
    minerCategory: "Individual Licence",
    miningLicenceNo: "ML/G/2023/00412",
    fgrRegistrationNo: "FGR/2023/0456",
    mmcRegistrationNo: "",
    primaryOperatingArea: "Mashonaland West",
    primaryMineral: "Gold",
    operatingAs: "Individual (sole operator)",
    beneficialOwners: [],
    pepStatus: "Not a PEP",
    highRiskArea: "No",
    additionalRiskNotes: "No additional risk factors identified"
};

const entityTestData = {
    fullName: "ZimGold Mining Cooperative",
    dateOfBirth: "2020-01-01",
    nationalId: "20-000000A01",
    nationality: "Zimbabwean",
    phoneNumber: "+263712345678",
    emailAddress: "info@zimgold.coop",
    physicalAddress: "45 Industrial Area, Shurugwi, Zimbabwe",
    minerCategory: "Cooperative",
    miningLicenceNo: "ML/G/2023/00876",
    fgrRegistrationNo: "FGR/2023/0789",
    mmcRegistrationNo: "",
    primaryOperatingArea: "Midlands",
    primaryMineral: "Gold",
    operatingAs: "Entity",
    beneficialOwners: [
        {
            name: "Chinoda, Tendai",
            idNumber: "82-234567B90",
            percentageOwnership: 35.5
        },
        {
            name: "Mujuru, Samuel",
            idNumber: "78-345678C12",
            percentageOwnership: 40.0
        },
        {
            name: "Nyoni, Grace",
            idNumber: "80-456789D34",
            percentageOwnership: 24.5
        }
    ],
    pepStatus: "Not a PEP",
    highRiskArea: "No",
    additionalRiskNotes: "Cooperative with 15 members, all vetted"
};

console.log('=== KYC/CDD Registration System Test Data ===\n');
console.log('1. Individual Registration Test:');
console.log(JSON.stringify(testData, null, 2));
console.log('\n2. Entity Registration Test:');
console.log(JSON.stringify(entityTestData, null, 2));
console.log('\n=== Expected Compliance Scores ===');
console.log('Individual Test: 95/100 (All low-risk factors)');
console.log('Entity Test: 85/100 (Entity structure slightly higher risk)');
console.log('\n=== Test Instructions ===');
console.log('1. Start the server: npm start');
console.log('2. Open browser: http://localhost:5000');
console.log('3. Fill form with test data above');
console.log('4. Verify submission success');
console.log('5. Check database for records');
console.log('6. Test validation with invalid data');
