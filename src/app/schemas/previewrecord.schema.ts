import { MaterialSubTask } from "./materialsubtask.schema"
import { MaterialAttribute } from "./materialattribute.schema"
import { ResolvedDevice } from "./resolveddevice.schema"

export interface PreviewRecord {
    id: string
    row: any
    deviceId?: string
    resolvedDevice?: ResolvedDevice
    messages: string[]
    subTaskDefs: MaterialSubTask[]
    attrs: MaterialAttribute[]
}