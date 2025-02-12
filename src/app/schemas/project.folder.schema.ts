export interface ProjectFolder {
    id: string
    creator_user_id: number
    last_editor_user_id: number
    project_id: string
    resolved_conflict: boolean
    created_at: string
    updated_at: string
    device_created_at: string
    device_updated_at: string
    deleted_at?: string
    name: string
    process_state?: string
    cascade_deleted_dependents_count?: number
    required_role: string
    folder_id?: string
    cascade_deleted_by_id?: string
    deleted_by_two_way_sync?: boolean
    kind: string
    integration_metadata: any
}