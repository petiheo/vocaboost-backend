const supabase = require('../config/database');

class Classroom {
    static async create(classroomData) {
        const { data, error } = await supabase
            .from('classrooms')
            .insert(classroomData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async findById(id) {
        const { data, error } = await supabase
            .from('classrooms')
            .select(`
                *,
                teacher:users!teacher_id(full_name, email),
                students:classroom_students(
                    student:users!student_id(id, full_name, email)
                )
            `)
            .eq('id', id)
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async findByTeacher(teacherId) {
        const { data, error } = await supabase
            .from('classrooms')
            .select(`
                *,
                student_count:classroom_students(count)
            `)
            .eq('teacher_id', teacherId)
            .eq('is_active', true);
            
        if (error) throw error;
        return data;
    }
    
    static async findByStudent(studentId) {
        const { data, error } = await supabase
            .from('classroom_students')
            .select(`
                classroom:classrooms(
                    *,
                    teacher:users!teacher_id(full_name)
                )
            `)
            .eq('student_id', studentId)
            .eq('status', 'active');
            
        if (error) throw error;
        return data?.map(item => item.classroom) || [];
    }
    
    static async findByCode(classCode) {
        const { data, error } = await supabase
            .from('classrooms')
            .select('*')
            .eq('class_code', classCode)
            .eq('is_active', true)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
    
    static async update(id, updates) {
        const { data, error } = await supabase
            .from('classrooms')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async addStudent(classroomId, studentId) {
        const { data, error } = await supabase
            .from('classroom_students')
            .insert({
                classroom_id: classroomId,
                student_id: studentId,
                status: 'active'
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async removeStudent(classroomId, studentId) {
        const { error } = await supabase
            .from('classroom_students')
            .update({
                status: 'removed',
                left_at: new Date()
            })
            .eq('classroom_id', classroomId)
            .eq('student_id', studentId);
            
        if (error) throw error;
        return true;
    }
}

module.exports = Classroom;