import '../../pair-components/tooltip';
import '../participant_profile/profile_avatar';

import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {core} from '../../core/core';
import {CohortService} from '../../services/cohort.service';
import {RouterService} from '../../services/router.service';

import {
  ParticipantProfile,
} from '@deliberation-lab/utils';
import {
  getParticipantName,
  getParticipantPronouns
} from '../../shared/participant.utils';

import {styles} from './progress_stage_completed.scss';

/** Progress component: Shows how many participants have completed the stage */
@customElement('progress-stage-completed')
export class Progress extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly cohortService = core.getService(CohortService);
  private readonly routerService = core.getService(RouterService);

  override render() {
    const stageId = this.routerService.activeRoute.params['stage'];
    const { completed, notCompleted } = this.cohortService.getParticipantsByCompletion(stageId);

    return html`
      ${this.renderParticipants(completed)}
      <div class="status">
        ${completed.length} of
        ${completed.length + notCompleted.length}
        participants completed this stage
      </div>
    `;
  }

  private renderParticipant(participant: ParticipantProfile) {
    return html`
      <profile-avatar
        class="participant"
        .small=${true}
        .emoji=${participant.avatar}
        .tooltip=${getParticipantName(participant)}
      >
      </profile-avatar>
    `;
  }

  private renderParticipants(participants: ParticipantProfile[]) {
    return html`
      <div class="participants-wrapper">
        ${participants.map((p) => this.renderParticipant(p))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'progress-stage-completed': Progress;
  }
}
