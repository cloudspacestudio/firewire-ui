import { Component, inject, ChangeDetectionStrategy } from "@angular/core"

import { RouterLink } from "@angular/router"

import { MatButtonModule } from "@angular/material/button"

import { AuthService } from "../../auth/auth.service"

@Component({
    standalone: true,
    selector: 'logged-out-page',
    imports: [RouterLink, MatButtonModule],
    templateUrl: './logged-out.page.html',
    changeDetection: ChangeDetectionStrategy.Eager,
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
