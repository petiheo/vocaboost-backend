// Test script for teacher verification endpoints
// Usage: node tests/teacher-verification.test.js

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
let authToken = ''; // Set your JWT token here
let adminToken = ''; // Set admin JWT token here

// Helper function to make requests
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Authorization': `Bearer ${options.admin ? adminToken : authToken}`,
  };

  const config = {
    method: options.method || 'GET',
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  if (options.body && !(options.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(options.body);
  } else if (options.body) {
    config.body = options.body;
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    console.log(`\n${config.method} ${endpoint}`);
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    return { status: response.status, data };
  } catch (error) {
    console.error('Request failed:', error.message);
    return { error };
  }
}

// Test cases
async function runTests() {
  console.log('🧪 Starting Teacher Verification Tests\n');

  // Test 1: Submit verification request without file
  console.log('=== Test 1: Submit Verification (No File) ===');
  const formData1 = new FormData();
  formData1.append('fullName', 'John Doe');
  formData1.append('institution', 'University of Science, VNU-HCM');
  formData1.append('schoolEmail', 'john.doe@hcmus.edu.vn');
  formData1.append('additionalNotes', 'I have been teaching English for 5 years');

  await makeRequest('/teacher/verification/submit', {
    method: 'POST',
    body: formData1,
  });

  // Test 2: Submit verification request with file
  console.log('\n=== Test 2: Submit Verification (With File) ===');
  const formData2 = new FormData();
  formData2.append('fullName', 'Jane Smith');
  formData2.append('institution', 'International University - VNU HCM');
  formData2.append('schoolEmail', 'jane.smith@hcmiu.edu.vn');
  formData2.append('additionalNotes', 'Teaching IELTS preparation courses');
  
  // Create a test file (you can replace this with an actual file)
  const testFile = Buffer.from('This is a test teacher ID card', 'utf-8');
  formData2.append('credentials', testFile, {
    filename: 'teacher-id.pdf',
    contentType: 'application/pdf',
  });

  await makeRequest('/teacher/verification/submit', {
    method: 'POST',
    body: formData2,
  });

  // Test 3: Check verification status
  console.log('\n=== Test 3: Check Verification Status ===');
  await makeRequest('/teacher/verification/status');

  // Test 4: Try to submit duplicate request (should fail)
  console.log('\n=== Test 4: Submit Duplicate Request (Should Fail) ===');
  await makeRequest('/teacher/verification/submit', {
    method: 'POST',
    body: formData1,
  });

  // Admin Tests
  console.log('\n\n🔐 Admin Tests (Requires Admin Token)\n');

  // Test 5: Get pending requests (Admin)
  console.log('=== Test 5: Get Pending Requests ===');
  await makeRequest('/teacher/verification/requests/pending?limit=10', {
    admin: true,
  });

  // Test 6: Get all requests (Admin)
  console.log('\n=== Test 6: Get All Requests ===');
  await makeRequest('/teacher/verification/requests?status=pending&limit=5', {
    admin: true,
  });

  // Test 7: Approve request (Admin)
  console.log('\n=== Test 7: Approve Request ===');
  const requestId = 'replace-with-actual-request-id'; // Get from pending requests
  await makeRequest(`/teacher/verification/requests/${requestId}/approve`, {
    method: 'PUT',
    admin: true,
  });

  // Test 8: Reject request (Admin)
  console.log('\n=== Test 8: Reject Request ===');
  const rejectId = 'replace-with-actual-request-id'; // Get from pending requests
  await makeRequest(`/teacher/verification/requests/${rejectId}/reject`, {
    method: 'PUT',
    admin: true,
    body: {
      rejectionReason: 'The uploaded document does not clearly show teaching credentials. Please upload your official teacher ID or employment letter.',
    },
  });

  // Validation Tests
  console.log('\n\n⚠️  Validation Tests\n');

  // Test 9: Invalid data
  console.log('=== Test 9: Submit with Invalid Data ===');
  const invalidForm = new FormData();
  invalidForm.append('fullName', 'J'); // Too short
  invalidForm.append('institution', ''); // Empty
  invalidForm.append('schoolEmail', 'not-an-email'); // Invalid email

  await makeRequest('/teacher/verification/submit', {
    method: 'POST',
    body: invalidForm,
  });

  // Test 10: Invalid file type
  console.log('\n=== Test 10: Submit with Invalid File Type ===');
  const invalidFileForm = new FormData();
  invalidFileForm.append('fullName', 'Test User');
  invalidFileForm.append('institution', 'Test School');
  invalidFileForm.append('schoolEmail', 'test@school.edu');
  
  const invalidFile = Buffer.from('console.log("malicious code")', 'utf-8');
  invalidFileForm.append('credentials', invalidFile, {
    filename: 'hack.js',
    contentType: 'application/javascript',
  });

  await makeRequest('/teacher/verification/submit', {
    method: 'POST',
    body: invalidFileForm,
  });

  console.log('\n\n✅ Tests completed!');
  console.log('\nNote: Replace token values and request IDs with actual values for real testing.');
}

// Instructions
function printInstructions() {
  console.log('📋 Teacher Verification Test Instructions\n');
  console.log('1. Make sure your backend server is running');
  console.log('2. Set the authToken variable with a valid JWT token');
  console.log('3. Set the adminToken variable with an admin JWT token');
  console.log('4. Run specific tests by commenting out others');
  console.log('5. Check email inbox for notification emails\n');
}

// Run tests
if (require.main === module) {
  printInstructions();
  
  // Uncomment to run tests
  // runTests();
}

module.exports = { makeRequest, runTests };