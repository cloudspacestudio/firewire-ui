import { Component, Input } from "@angular/core";
import { NgFor } from "@angular/common";

@Component({
    selector: 'mission-tabular-component',
    standalone: true,
    template: `
        <table>
            <thead>
                <th *ngFor="let head of this.getKeys()">{{head}}</th>
            </thead>
            <tbody>
                <tr *ngFor="let row of datasource">
                    <td *ngFor="let column of this.getKeys()">
                        {{this.renderValue(row[column])}}
                    </td>
                </tr>
            </tbody>
        </table>
    `,
    imports: [NgFor]
})
export class TabularComponent {
    @Input() datasource: any[] = []

    getKeys() {
        if (!this.datasource || !Array.isArray(this.datasource) || this.datasource.length <= 0) {
            return []
        }
        return Object.keys(this.datasource[0])
    }

    renderValue(input: any): any {
        return input
    }
}