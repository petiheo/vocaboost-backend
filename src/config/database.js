const { createClient } = require('@supabase/supabase-js');

// Khởi tạo Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // Dùng service key cho backend
);

// Test connection
const testConnection = async () => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        console.log('✅ Supabase connected successfully');
    } catch (error) {
        console.error('❌ Supabase connection failed:', error.message);
    }
};

// Test khi khởi động
testConnection();

module.exports = supabase;