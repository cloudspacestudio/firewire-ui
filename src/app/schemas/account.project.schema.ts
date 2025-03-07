export interface AccountProjectSchema {
    deleted_at?: Date
    created_at: Date
    updated_at: Date
    resolved_conflict: boolean
    device_created_at: Date
    device_updated_at: Date
    account_id: number
    address: string
    anchor_region: string
    archived_at: Date
    code: string
    color: string
    currency: string
    default_pm_group_id: string
    has_logo: boolean
    id: string
    is_3d_bim_enabled: boolean
    is_mobile_location_creation_enabled: boolean
    is_email_notifications_enabled: boolean
    man_power_units: string
    name: string
    owner_email: string
    plan_name: string
    prompt_effort_on_complete: boolean
    sheets_limit?: number
    time_zone: string
    is_analytics_enabled: boolean
    min_api_version?: string
    is_submittals_enabled: boolean
    is_project_labels_enabled: boolean
    project_attributes: AccountProjectAttributes[]
    is_change_orders_enabled: boolean
    is_budget_enabled: boolean
    is_pm_enabled: boolean
    is_field_enabled: boolean
    is_plan_text_search_enabled: boolean
    is_premium: boolean
    is_enterprise: boolean
    logo_url: string
    work_week: boolean[]
}

export interface AccountProjectAttributes {
    id: string
    creator_user_id: number
    last_editor_user_id: number
    resolved_conflict: boolean
    created_at: string
    updated_at: string
    device_created_at: string
    device_updated_at: string
    deleted_at?: string
    account_id: number
    name: string
    color: string
    kind: string // label
    projects_project_attribute_id: string
}