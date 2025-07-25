export interface TaskDetailSchema {
    cost_value: number
    created_at: Date
    creator_user_id: string
    deleted_at?: Date
    device_created_at: Date
    device_updated_at: Date
    due_at?: Date
    due_date?: Date
    end_at?: Date
    fixed_at?: Date
    floorplan_id: string
    id: string
    is_local: boolean
    is_private: boolean
    last_editor_user_id: number
    latest_component_device_updated_at: Date
    location_id?: string
    man_power_value: number
    name: string
    owner_user_id: string
    pos_x: number
    pos_y: number
    pos_z: number
    priority: number
    project_id: string
    resolved_conflict: boolean
    sequence_number: number
    start_at?: Date
    status_id: string
    task_type_id: string
    team_id: string
    updated_at: Date
    user_ids: number[]
    verified_at?: Date
}