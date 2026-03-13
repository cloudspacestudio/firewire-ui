import { Component, inject } from "@angular/core"
import { CommonModule } from "@angular/common"
import { RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"

import { AuthService } from "../../auth/auth.service"

@Component({
    standalone: true,
    selector: 'logged-out-page',
    imports: [CommonModule, RouterLink, MatButtonModule],
    templateUrl: './logged-out.page.html',
    styleUrls: ['./logged-out.page.scss']
})
export class LoggedOutPage {
    private readonly auth = inject(AuthService)

    signIn(): void {
        this.auth.signIn().catch((err) => {
            console.error('Sign in failed', err)
        })
    }
}
