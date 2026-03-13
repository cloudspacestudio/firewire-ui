import { Component } from "@angular/core"

import { PageToolbar } from '../../common/components/page-toolbar'

@Component({
    standalone: true,
    imports: [PageToolbar],
    template: `
        <page-toolbar></page-toolbar>
        <div class="placeholder-page">
            <div class="placeholder-card">
                <div class="placeholder-eyebrow">Install</div>
                <h1>Install workspace is not built out yet.</h1>
                <p>This tile is now in place for the upcoming installation workflow area.</p>
            </div>
        </div>
    `,
    styles: [`
        .placeholder-page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 96px 24px 24px;
            background: linear-gradient(180deg, #08111d, #050910);
        }

        .placeholder-card {
            width: min(680px, 100%);
            padding: 28px;
            border: 1px solid rgba(132, 255, 190, 0.18);
            border-radius: 20px;
            background: linear-gradient(135deg, rgba(7, 15, 25, 0.92), rgba(14, 28, 29, 0.72));
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
            color: #edf8ff;
        }

        .placeholder-eyebrow {
            margin-bottom: 8px;
            color: #84ffbe;
            font-size: 0.72rem;
            letter-spacing: 0.2em;
            text-transform: uppercase;
        }

        h1 {
            margin: 0 0 12px;
            font-size: clamp(1.6rem, 3vw, 2.4rem);
        }

        p {
            margin: 0;
            color: rgba(237, 248, 255, 0.8);
        }
    `]
})
export class InstallPage {}
