import { AccountProjectSchema } from "./account.project.schema";
import { PreviewResponse } from "./previewresponse.schema";

export interface PreviewDialogSchema {
    file: any,
    project?: AccountProjectSchema,
    floorplan: any,
    templateId: string,
    locationId: string,
    data: PreviewResponse
}