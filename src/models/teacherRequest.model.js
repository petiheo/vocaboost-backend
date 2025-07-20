const supabase = require('../config/database');

class TeacherRequestModel {
  async create(data) {
    const { data: result, error } = await supabase
      .from('teacher_requests')
      .insert({
        user_id: data.userId,
        institution: data.institution,
        credentials_url: data.credentialsUrl,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async findByUserId(userId) {
    const { data, error } = await supabase
      .from('teacher_requests')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updateStatus(id, status, reviewerId, rejectionReason = null) {
    const updateData = {
      status,
      reviewed_by: reviewerId,
    };

    if (rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { data, error } = await supabase
      .from('teacher_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findAll(filters = {}) {
    let query = supabase
      .from('teacher_requests')
      .select(`
        *,
        users!teacher_requests_user_id_fkey (
          id,
          email,
          display_name
        )
      `);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}

module.exports = new TeacherRequestModel();