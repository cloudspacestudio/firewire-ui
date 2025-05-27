import {Component, inject, OnInit} from '@angular/core'
import { Resolve, RouterLink } from '@angular/router'
import { NgIf, NgFor } from '@angular/common'
import {
    MAT_DIALOG_DATA,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose
} from '@angular/material/dialog'
import { MatButtonModule } from '@angular/material/button'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatListModule } from '@angular/material/list'
import { MatIconModule } from '@angular/material/icon'
import { MatBadgeModule } from '@angular/material/badge'
import { MatMenuModule } from '@angular/material/menu'
import { MatCardModule } from '@angular/material/card'
import { MatProgressBar, MatProgressBarModule, ProgressBarMode } from '@angular/material/progress-bar'

import { PreviewDialogSchema } from '../../schemas/previewdialog.schema'
import { ResolvedDevice } from '../../schemas/resolveddevice.schema'
import { MaterialAttribute } from '../../schemas/materialattribute.schema'
import { MaterialSubTask } from '../../schemas/materialsubtask.schema'
import { PreviewRecord } from '../../schemas/previewrecord.schema'
import { PreviewResponse } from '../../schemas/previewresponse.schema'

@Component({
    standalone: true,
    templateUrl: './execute.dialog.html',
    imports: [MatDialogTitle, MatDialogContent, 
        MatDialogActions, MatButtonModule,
        MatDialogClose, MatToolbarModule,
        MatListModule, MatIconModule,
        MatBadgeModule, MatMenuModule,
        MatCardModule, MatProgressBarModule],
})
export class ExecuteDialog implements OnInit {
    previewResponse: PreviewDialogSchema = inject(MAT_DIALOG_DATA)
    mode: ProgressBarMode = 'indeterminate'
    indx = 0
    max = this.previewResponse.data.preview.length
    value = 0

    ngOnInit() {
        console.dir(this.previewResponse)
        this.mode = 'determinate'
        setTimeout(async() => {
            try {
                await this.createTasks()
                
            } catch (err) {
                console.error(err)
            }
        })
    }

    private createTasks() {
        return new Promise(async(resolve, reject) => {
            try {
                this.mode = 'determinate'
                for(let i = 0; i < this.max;i++) {
                    this.indx++
                    const record = this.previewResponse.data.preview[i]
                    this.value = this.indx / this.max * 100

                    await this.sleep(1000)
                }
                return resolve(true)
            } catch (err) {
                return reject(err)
            }
        })
    }

    private sleep(ms: number) {
        return new Promise((resolve) => {
            setTimeout(() => {
                return resolve(true)
            }, ms)
        })
    }

}
