import { Component, Input } from "@angular/core";
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { NgFor } from "@angular/common";

@Component({
    selector: 'mission-tabular-component',
    standalone: true,
    template: `
        <table class="raw-table">
            <thead>
                <th *ngFor="let head of this.getKeys()">{{head}}</th>
            </thead>
            <tbody>
                <tr *ngFor="let row of datasource">
                    <td *ngFor="let column of this.getKeys()" [innerHtml]="this.renderValue(row[column])"></td>
                </tr>
            </tbody>
        </table>
    `,
    imports: [NgFor]
})
export class TabularComponent {
    @Input() datasource: any[] = []

    constructor(private sanitizer: DomSanitizer) {}

    getKeys() {
        if (!this.datasource || !Array.isArray(this.datasource) || this.datasource.length <= 0) {
            return []
        }
        return Object.keys(this.datasource[0])
    }

    renderValue(input: any): any {
        const images = ['.jpg', 'jpeg', '.gif', '.png','.bmp']
        if (input && input.toLowerCase && input.toLowerCase().startsWith('http')) {
            const lastFourChars = input.toLowerCase().substring(input.length - 4)
            if (images.indexOf(lastFourChars)>=0) {
                const text = `<a href="${input}" target="_blank">
                <img src="${input}" style="height: 80px;max-height: 80px;" />
                </a>`
                const response: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(text)
                return response
            } else if (input.toLowerCase().endsWith('.pdf')) {
                const text = `<a href="${input}" target="_blank">
                <img src="/images/pdf.png" style="width: 40px;max-width: 40px;" />
                </a>`
                const response: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(text)
                return response
            } else if (input.toLowerCase().endsWith('.txt')) {
                const text = `<a href="${input}" target="_blank">
                <img src="/images/txt.png" style="width: 40px;max-width: 40px;" />
                </a>`
                const response: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(text)
                return response
            } else {
                return `<a href="${input}"  target="_blank">${input}</a>`
            }
        }
        return input
    }
}