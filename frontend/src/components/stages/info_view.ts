import '../progress/progress_stage_completed';

import './stage_description';
import './stage_footer';

import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {InfoStageConfig, getTimeElapsed} from '@deliberation-lab/utils';
import {core} from '../../core/core';
import {ParticipantService} from '../../services/participant.service';

import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {convertMarkdownToHTML} from '../../shared/utils';
import {styles} from './info_view.scss';

/** Info stage view for participants. */
@customElement('info-view')
export class InfoView extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly participantService = core.getService(ParticipantService);

  @property() stage: InfoStageConfig | null = null;

  private timerInterval: number | undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.timerInterval = window.setInterval(() => {
      if (this.stage?.timeMinimumInMinutes || this.stage?.timeLimitInMinutes) {
        this.requestUpdate();
      }
    }, 1000);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.timerInterval);
  }

  override render() {
    if (!this.stage) {
      return nothing;
    }

    const startTimestamp =
      this.participantService.profile?.timestamps.readyStages[this.stage.id];
    const elapsedMinutes = startTimestamp
      ? getTimeElapsed(startTimestamp, 'm')
      : 0;

    // Timing check:
    // - timeMinimumInMinutes strictly gates the "Next stage" button until met.
    // - timeLimitInMinutes drives the visual countdown timer in participant-header;
    //   participants can still view info after the max time is reached (no hard cutoff).
    const minTimeMet =
      this.stage.timeMinimumInMinutes == null ||
      this.stage.timeMinimumInMinutes <= 0 ||
      (startTimestamp != null &&
        elapsedMinutes >= this.stage.timeMinimumInMinutes);

    const infoLinesJoined = this.stage?.infoLines.join('\n\n');
    return html`
      <stage-description .stage=${this.stage}></stage-description>
      <div class="html-wrapper">
        <div class="info-block">
          ${unsafeHTML(convertMarkdownToHTML(infoLinesJoined))}
        </div>
        ${this.stage.youtubeVideoId
          ? html`
              <iframe
                width="560"
                height="315"
                src="https://www.youtube.com/embed/${this.stage.youtubeVideoId}"
                title="YouTube video player"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
              >
              </iframe>
            `
          : nothing}
      </div>
      <stage-footer .disabled=${!minTimeMet}>
        ${this.stage.progress.showParticipantProgress
          ? html`<progress-stage-completed></progress-stage-completed>`
          : nothing}
        ${!minTimeMet ? this.renderMinTimeMessage(elapsedMinutes) : nothing}
      </stage-footer>
    `;
  }

  private renderMinTimeMessage(elapsedMinutes: number) {
    const remaining = Math.ceil(
      (this.stage?.timeMinimumInMinutes ?? 0) - elapsedMinutes,
    );
    return html`
      <div class="description">
        You must stay on this page for at least ${remaining} more
        minute${remaining !== 1 ? 's' : ''}.
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'info-view': InfoView;
  }
}
