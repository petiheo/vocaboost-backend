const supabase = require('../config/database');

async function findByGoogleId(googleId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('google_id', googleId)
    .single();
    
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function createDefaultSettings(userId) {
  const defaultSettings = {
    user_id: userId,
    daily_goal: 10,
    notification_email: true,
    notification_push: true,
    timezone: 'Asia/Ho_Chi_Minh',
    language: 'vi',
    theme: 'light',
    created_at: new Date(),
    updated_at: new Date()
  };

  const { data, error } = await supabase
    .from('user_settings')
    .insert(defaultSettings)
    .select()
    .single();
    
  if (error && error.code !== '23505') { // Ignore duplicate key error
    throw error;
  }
  
  return data || defaultSettings;
}

async function createDefaultProfile(userId) {
  const defaultProfile = {
    user_id: userId,
    bio: null,
    location: null,
    website: null,
    created_at: new Date()
  };

  const { data, error } = await supabase
    .from('user_profiles')
    .insert(defaultProfile)
    .select()
    .single();
    
  if (error && error.code !== '23505') { // Ignore duplicate key error
    throw error;
  }
  
  return data || defaultProfile;
}

async function createDefaultStats(userId) {
  const defaultStats = {
    user_id: userId,
    total_vocabulary: 0,
    total_reviews: 0,
    correct_reviews: 0,
    current_streak: 0,
    max_streak: 0,
    total_learning_time: 0,
    created_at: new Date(),
    updated_at: new Date()
  };

  const { data, error } = await supabase
    .from('user_stats')
    .insert(defaultStats)
    .select()
    .single();
    
  if (error && error.code !== '23505') { // Ignore duplicate key error
    throw error;
  }
  
  return data || defaultStats;
}

async function initializeUserData(userId) {
  try {
    await Promise.all([
      createDefaultSettings(userId),
      createDefaultProfile(userId),
      createDefaultStats(userId)
    ]);
  } catch (error) {
    console.error('Failed to initialize user data:', error);
    // Non-critical error, don't throw
  }
}

async function changePassword(userId, currentPassword, newPassword) {
  const User = require('./User');
  
  // Get user with password hash
  const { data: user, error } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('id', userId)
    .single();
    
  if (error || !user) {
    throw new Error('User not found');
  }
  
  // Verify current password
  const isValid = await User.validatePassword(currentPassword, user.password_hash);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }
  
  // Hash new password
  const newPasswordHash = await User.hashPassword(newPassword);
  
  // Update password
  await User.update(userId, {
    password_hash: newPasswordHash,
    password_changed_at: new Date()
  });
}

function extendUserModel() {
  const User = require('./User');
  
  // Add methods to User class
  User.findByGoogleId = findByGoogleId;
  User.createDefaultSettings = createDefaultSettings;
  User.createDefaultProfile = createDefaultProfile;
  User.createDefaultStats = createDefaultStats;
  User.initializeUserData = initializeUserData;
  User.changePassword = changePassword;
}

module.exports = {
  findByGoogleId,
  createDefaultSettings,
  createDefaultProfile,
  createDefaultStats,
  initializeUserData,
  changePassword,
  extendUserModel
};