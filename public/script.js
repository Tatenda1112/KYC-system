// Form validation and submission logic
class RegistrationForm {
    constructor() {
        this.form = document.getElementById('registrationForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.clearBtn = document.getElementById('clearForm');
        this.operatingAsSelect = document.getElementById('operatingAs');
        this.beneficialOwnersSection = document.getElementById('beneficialOwnersSection');
        this.addBeneficialOwnerBtn = document.getElementById('addBeneficialOwner');
        this.beneficialOwnersList = document.getElementById('beneficialOwnersList');
        
        this.beneficialOwners = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupFormValidation();
    }

    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Clear form
        this.clearBtn.addEventListener('click', () => {
            this.clearForm();
        });

        // Operating as change
        this.operatingAsSelect.addEventListener('change', () => {
            this.toggleBeneficialOwnersSection();
        });

        // Add beneficial owner
        this.addBeneficialOwnerBtn.addEventListener('click', () => {
            this.addBeneficialOwner();
        });

        // Phone number formatting
        const phoneInput = document.getElementById('phoneNumber');
        phoneInput.addEventListener('input', (e) => {
            this.formatPhoneNumber(e.target);
        });

        // National ID formatting
        const nationalIdInput = document.getElementById('nationalId');
        nationalIdInput.addEventListener('input', (e) => {
            this.formatNationalId(e.target);
        });
    }

    setupFormValidation() {
        // Real-time validation
        const inputs = this.form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
            });

            input.addEventListener('input', () => {
                this.clearFieldError(input);
            });
        });
    }

    validateField(field) {
        const fieldName = field.name;
        const value = field.value.trim();
        const errorElement = field.parentElement.querySelector('.error-message');
        
        let isValid = true;
        let errorMessage = '';

        // Required field validation
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        // Specific field validations
        switch (fieldName) {
            case 'fullName':
                if (value.length < 3 || value.length > 100) {
                    isValid = false;
                    errorMessage = 'Full name must be 3-100 characters';
                }
                break;

            case 'dateOfBirth':
                if (value) {
                    const age = new Date().getFullYear() - new Date(value).getFullYear();
                    if (age < 18 || age > 100) {
                        isValid = false;
                        errorMessage = 'Applicant must be between 18 and 100 years old';
                    }
                }
                break;

            case 'nationalId':
                const idPattern = /^[0-9]{2}-[0-9]{6}[A-Z][0-9]{2}$/;
                if (!idPattern.test(value)) {
                    isValid = false;
                    errorMessage = 'Invalid Zimbabwean ID format (e.g., 63-123456A21)';
                }
                break;

            case 'phoneNumber':
                const phonePattern = /^\+263[0-9]{9}$/;
                if (!phonePattern.test(value)) {
                    isValid = false;
                    errorMessage = 'Invalid Zimbabwean phone number format (e.g., +263771234567)';
                }
                break;

            case 'emailAddress':
                if (value) {
                    const emailPattern = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
                    if (!emailPattern.test(value)) {
                        isValid = false;
                        errorMessage = 'Invalid email format';
                    }
                }
                break;

            case 'physicalAddress':
                if (value.length < 10 || value.length > 200) {
                    isValid = false;
                    errorMessage = 'Address must be 10-200 characters';
                }
                break;

            case 'miningLicenceNo':
                if (value.length < 5 || value.length > 50) {
                    isValid = false;
                    errorMessage = 'Licence number must be 5-50 characters';
                }
                break;

            case 'additionalRiskNotes':
                if (value.length > 500) {
                    isValid = false;
                    errorMessage = 'Risk notes cannot exceed 500 characters';
                }
                break;
        }

        // Display error or success
        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }

        return isValid;
    }

    showFieldError(field, message) {
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
            field.classList.add('border-red-500');
        }
    }

    clearFieldError(field) {
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.classList.add('hidden');
            field.classList.remove('border-red-500');
        }
    }

    formatPhoneNumber(input) {
        let value = input.value.replace(/\s+/g, '');
        if (!value.startsWith('+263')) {
            value = '+263' + value.replace(/^\+?263?/, '');
        }
        input.value = value;
    }

    formatNationalId(input) {
        let value = input.value.toUpperCase().replace(/\s+/g, '');
        if (value.length === 10 && !value.includes('-')) {
            value = value.slice(0, 2) + '-' + value.slice(2, 8) + value.slice(8);
        }
        input.value = value;
    }

    toggleBeneficialOwnersSection() {
        const operatingAs = this.operatingAsSelect.value;
        if (operatingAs === 'Individual (sole operator)') {
            this.beneficialOwnersSection.classList.add('hidden');
            this.beneficialOwners = [];
        } else {
            this.beneficialOwnersSection.classList.remove('hidden');
            if (this.beneficialOwners.length === 0) {
                this.addBeneficialOwner();
            }
        }
    }

    addBeneficialOwner() {
        const ownerIndex = this.beneficialOwners.length;
        const ownerDiv = document.createElement('div');
        ownerDiv.className = 'beneficial-owner-row grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg';
        ownerDiv.innerHTML = `
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span class="text-red-500">*</span>
                </label>
                <input type="text" name="beneficialOwnerName${ownerIndex}" required
                    class="form-input w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Owner full name">
                <span class="text-red-500 text-sm hidden error-message"></span>
            </div>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    ID Number <span class="text-red-500">*</span>
                </label>
                <input type="text" name="beneficialOwnerId${ownerIndex}" required
                    class="form-input w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ID number">
                <span class="text-red-500 text-sm hidden error-message"></span>
            </div>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    Ownership % <span class="text-red-500">*</span>
                </label>
                <div class="flex">
                    <input type="number" name="beneficialOwnerPercentage${ownerIndex}" required
                        min="25" max="100" step="0.1"
                        class="form-input flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="25-100">
                    <button type="button" onclick="registrationForm.removeBeneficialOwner(${ownerIndex})"
                        class="px-3 py-2 bg-red-500 text-white rounded-r-lg hover:bg-red-600 transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <span class="text-red-500 text-sm hidden error-message"></span>
            </div>
        `;
        
        this.beneficialOwnersList.appendChild(ownerDiv);
        this.beneficialOwners.push(ownerIndex);

        // Add validation to new fields
        const newInputs = ownerDiv.querySelectorAll('input');
        newInputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateBeneficialOwnerField(input);
            });
            input.addEventListener('input', () => {
                this.clearFieldError(input);
            });
        });
    }

    removeBeneficialOwner(index) {
        const ownerRows = this.beneficialOwnersList.querySelectorAll('.beneficial-owner-row');
        if (ownerRows[index]) {
            ownerRows[index].remove();
            this.beneficialOwners = this.beneficialOwners.filter(i => i !== index);
        }
    }

    validateBeneficialOwnerField(field) {
        const fieldName = field.name;
        const value = field.value.trim();
        
        let isValid = true;
        let errorMessage = '';

        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        if (fieldName.includes('beneficialOwnerId')) {
            const idPattern = /^[0-9]{2}-[0-9]{6}[A-Z][0-9]{2}$/;
            if (!idPattern.test(value)) {
                isValid = false;
                errorMessage = 'Invalid Zimbabwean ID format';
            }
        }

        if (fieldName.includes('beneficialOwnerPercentage')) {
            const percentage = parseFloat(value);
            if (percentage < 25 || percentage > 100) {
                isValid = false;
                errorMessage = 'Ownership must be 25-100%';
            }
        }

        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }

        return isValid;
    }

    async handleSubmit() {
        // Validate all fields
        const inputs = this.form.querySelectorAll('input[required], select[required], textarea[required]');
        let isFormValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isFormValid = false;
            }
        });

        // Validate beneficial owners if applicable
        if (this.operatingAsSelect.value !== 'Individual (sole operator)') {
            const ownerInputs = this.beneficialOwnersList.querySelectorAll('input[required]');
            ownerInputs.forEach(input => {
                if (!this.validateBeneficialOwnerField(input)) {
                    isFormValid = false;
                }
            });
        }

        if (!isFormValid) {
            this.showError('Please correct all errors before submitting');
            return;
        }

        // Show loading state
        this.setLoadingState(true);

        try {
            const formData = this.collectFormData();
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess(result.data);
                this.form.reset();
                this.beneficialOwners = [];
                this.beneficialOwnersList.innerHTML = '';
                this.toggleBeneficialOwnersSection();
            } else {
                this.showError(result.message || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    collectFormData() {
        const formData = new FormData(this.form);
        const data = {};

        // Collect basic form data
        for (let [key, value] of formData.entries()) {
            data[key] = value.trim();
        }

        // Collect beneficial owners if applicable
        if (this.operatingAsSelect.value !== 'Individual (sole operator)') {
            data.beneficialOwners = [];
            const ownerRows = this.beneficialOwnersList.querySelectorAll('.beneficial-owner-row');
            
            ownerRows.forEach((row, index) => {
                const name = row.querySelector(`input[name="beneficialOwnerName${index}"]`).value.trim();
                const id = row.querySelector(`input[name="beneficialOwnerId${index}"]`).value.trim();
                const percentage = parseFloat(row.querySelector(`input[name="beneficialOwnerPercentage${index}"]`).value);
                
                if (name && id && percentage >= 25) {
                    data.beneficialOwners.push({ name, id, percentageOwnership: percentage });
                }
            });
        }

        return data;
    }

    setLoadingState(loading) {
        const submitText = this.submitBtn.querySelector('.submit-text');
        const spinner = this.submitBtn.querySelector('.loading-spinner');
        
        if (loading) {
            this.submitBtn.disabled = true;
            submitText.textContent = 'Submitting...';
            spinner.classList.add('active');
        } else {
            this.submitBtn.disabled = false;
            submitText.textContent = 'Submit Registration';
            spinner.classList.remove('active');
        }
    }

    showSuccess(data) {
        const modal = document.getElementById('successModal');
        const details = document.getElementById('registrationDetails');
        
        details.innerHTML = `
            <div class="space-y-2">
                <p><strong>Registration ID:</strong> ${data.id}</p>
                <p><strong>Name:</strong> ${data.fullName}</p>
                <p><strong>Licence No:</strong> ${data.miningLicenceNo}</p>
                <p><strong>Status:</strong> <span class="text-yellow-600">${data.registrationStatus}</span></p>
                <p><strong>Compliance Score:</strong> ${data.complianceScore}/100</p>
                <p><strong>Submitted:</strong> ${new Date(data.registrationDate).toLocaleDateString()}</p>
            </div>
        `;
        
        details.classList.remove('hidden');
        modal.classList.remove('hidden');
    }

    showError(message) {
        const modal = document.getElementById('errorModal');
        const errorMessage = document.getElementById('errorMessage');
        
        errorMessage.textContent = message;
        modal.classList.remove('hidden');
    }

    clearForm() {
        if (confirm('Are you sure you want to clear all form data?')) {
            this.form.reset();
            this.beneficialOwners = [];
            this.beneficialOwnersList.innerHTML = '';
            this.toggleBeneficialOwnersSection();
            
            // Clear all error messages
            const errorMessages = this.form.querySelectorAll('.error-message');
            errorMessages.forEach(error => {
                error.classList.add('hidden');
            });
            
            // Remove error styling
            const errorInputs = this.form.querySelectorAll('.border-red-500');
            errorInputs.forEach(input => {
                input.classList.remove('border-red-500');
            });
        }
    }
}

// Initialize the form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.registrationForm = new RegistrationForm();
});

// Modal functions
function closeSuccessModal() {
    document.getElementById('successModal').classList.add('hidden');
}

function closeErrorModal() {
    document.getElementById('errorModal').classList.add('hidden');
}

// Close modals when clicking outside
window.addEventListener('click', (event) => {
    const successModal = document.getElementById('successModal');
    const errorModal = document.getElementById('errorModal');
    
    if (event.target === successModal) {
        closeSuccessModal();
    }
    if (event.target === errorModal) {
        closeErrorModal();
    }
});
