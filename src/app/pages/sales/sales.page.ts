import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { PageToolbar } from '../../common/components/page-toolbar'

@Component({
    standalone: true,
    selector: 'sales-page',
    imports: [CommonModule, PageToolbar],
    templateUrl: './sales.page.html',
    styleUrls: ['./sales.page.scss']
})
export class SalesPage {}
