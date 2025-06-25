let supabase;
if (process.env.NODE_ENV !== 'test' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(
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
} else {
    console.warn('Supabase credentials not found - using mock database client');
    const dummyResult = Promise.resolve({ data: null, error: null });
    const chain = {
        select() { return this; },
        insert() { return this; },
        update() { return this; },
        delete() { return this; },
        limit() { return this; },
        eq() { return this; },
        single() { return dummyResult; },
        maybeSingle() { return dummyResult; },
        selectCount() { return dummyResult; }
    };
    supabase = {
        from() { return chain; }
    };
}

module.exports = supabase;