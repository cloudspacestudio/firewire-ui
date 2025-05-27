import { PreviewRecord } from "./previewrecord.schema";
import { ResolvedDevice } from "./resolveddevice.schema";

export interface PreviewResponse {
    devices: ResolvedDevice[]
    message: string
    unresolvedNames: string[]
    preview: PreviewRecord[]
}