export class Reducer {

    data: ReducerItem[] = [
        {
            id: 'STATS',
            fields: ['id','user_count','sheet_count',
                'priority_1_task_count', 'priority_2_task_count',
                'priority_3_task_count', 'task_count']
        },
        {
            id: 'FOLDERS',
            fields: ['id', 'name', 'kind']
        },
        {
            id: 'FLOORPLANS',
            fields: ['id', 'name', 'folder_id', 'updated_at']
        },
        {
            id: 'SHEETS',
            fields: ['id', 'name', 'file_name', 'version',
                'floorplan_id', 'file_width', 'file_height',
                'version_description', 'folder_id', 'thumb_url'
            ]
        },
        {
            id: 'STATUSES',
            fields: ['id', 'name', 'ordinal', 'kind', 'is_default']
        },
        {
            id: 'TEAMS',
            fields: ['id', 'name', 'handle']
        },
        {
            id: 'ATTACHMENTS',
            fields: ['name', 'folder_id', 'kind', 'file_size', 'file_url']
        }
    ]

    reduce(id: string, rows: any[]): ReducedResponse {
        const test = this.data.find(s => s.id===id)
        if (!test) {
            return {
                reduced: rows,
                full: rows
            }
        }
        if (!rows || rows.length <= 0) {
            return {
                reduced: rows,
                full: rows
            }
        }
        return {
            reduced: rows.map((s: any) => {
                const output: any = {}
                test.fields.forEach((field: string) => {
                    output[field] = s[field]
                })
                return output
            }),
            full: rows
        }
    }
}

export interface ReducerItem {
    id: string
    fields: string[]
}

export interface ReducedResponse {
    reduced: any[]
    full: any[]
}