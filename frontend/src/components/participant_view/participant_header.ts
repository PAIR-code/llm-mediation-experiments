import '../../pair-components/button';
import '../../pair-components/icon_button';
import '../../pair-components/info_popup';
import '../../pair-components/tooltip';
import '../../pair-components/icon';

import '../participant_profile/profile_display';

import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import {core} from '../../core/core';
import {CohortService} from '../../services/cohort.service';
import {ParticipantService} from '../../services/participant.service';

import {
  ChatStageConfig,
  ChatStagePublicData,
  ParticipantProfile,
  StageConfig,
  StageKind,
} from '@deliberation-lab/utils';
import {getChatTimeRemainingInSeconds} from '../../shared/stage.utils';
import {styles} from './participant_header.scss';

/** Header component for participant preview */
@customElement('participant-header')
export class Header extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly participantService = core.getService(ParticipantService);
  private readonly cohortService = core.getService(CohortService);

  @property() stage: StageConfig | undefined = undefined;
  @property() profile: ParticipantProfile | undefined = undefined;

  @state() timeRemaining: number | null = null;
  private timerInterval: number | undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.timerInterval = window.setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.timerInterval);
  }

  private updateTimer() {
    if (!this.stage) return;

    // Check if stage is chat, survey, or info (or other stage with time limit)
    if (
      this.stage.kind === StageKind.CHAT ||
      this.stage.kind === StageKind.PRIVATE_CHAT ||
      this.stage.kind === StageKind.SURVEY ||
      this.stage.kind === StageKind.INFO
    ) {
      if (this.stage.timeLimitInMinutes) {
        const publicStageData = this.cohortService.stagePublicDataMap[
          this.stage.id
        ] as ChatStagePublicData;

        const chatMap =
          this.stage.kind === StageKind.PRIVATE_CHAT
            ? this.participantService.privateChatMap
            : this.cohortService.chatMap;

        const startTimestamp =
          this.stage.kind === StageKind.CHAT
            ? publicStageData?.discussionStartTimestamp
            : this.participantService.profile?.timestamps.readyStages[
                this.stage.id
              ];

        this.timeRemaining = getChatTimeRemainingInSeconds(
          this.stage,
          chatMap,
          startTimestamp,
        );
      } else {
        this.timeRemaining = null;
      }
    } else {
      this.timeRemaining = null;
    }
  }

  override render() {
    if (!this.stage) {
      return nothing;
    }

    return html`
      <div class="header">
        <div class="left">
          ${this.renderMenu()} ${this.stage.name}${this.renderInfo()}
          ${this.renderTimer()}
        </div>
        <div class="right">
          ${this.renderHelpPanelToggle()} ${this.renderProfile()}
        </div>
      </div>
    `;
  }

  private renderMenu() {
    return html`
      <pr-icon-button
        class="menu-button"
        icon="menu"
        color="neutral"
        variant="default"
        @click=${() =>
          this.participantService.setShowParticipantSidenav(
            !this.participantService.showParticipantSidenav,
          )}
      >
      </pr-icon-button>
    `;
  }

  private renderProfile() {
    if (!this.profile) return nothing;
    return html`
      <pr-tooltip
        text="You are participating as this avatar"
        position="BOTTOM_END"
      >
        <participant-profile-display
          .profile=${this.profile}
          .stageId=${this.stage?.id ?? ''}
        >
        </participant-profile-display>
      </pr-tooltip>
    `;
  }

  private renderInfo() {
    if (!this.stage || this.stage.descriptions.infoText.length === 0) {
      return nothing;
    }
    return html`
      <info-popup .popupText=${this.stage.descriptions.infoText}></info-popup>
    `;
  }

  private renderHelpPanelToggle() {
    return html`
      <pr-tooltip
        text=" Click to message the administrator"
        position="BOTTOM_END"
      >
        <pr-icon-button
          icon="live_help"
          color="error"
          size="large"
          variant="default"
          @click=${() => {
            const current = this.participantService.getShowHelpPanel();
            this.participantService.setShowHelpPanel(!current);
          }}
        >
        </pr-icon-button>
      </pr-tooltip>
    `;
  }
  private renderTimer() {
    if (this.timeRemaining === null) return nothing;

    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = Math.floor(this.timeRemaining % 60);
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return html`
      <div class="timer">
        <pr-icon
          icon="timer"
          color="primary"
          size="large"
          variant="default"
        ></pr-icon>
        ${timeString}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'participant-header': Header;
  }
}
