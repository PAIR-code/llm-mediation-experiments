import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import {core} from '../../core/core';
import {AnalyticsService, ButtonClick} from '../../services/analytics.service';
import {ExperimentService} from '../../services/experiment.service';
import {ParticipantService} from '../../services/participant.service';
import {Pages, RouterService} from '../../services/router.service';
import {styles} from './stage_footer.scss';
import { ParticipantStatus } from '@deliberation-lab/utils';

/** Experiment stage footer */
@customElement('stage-footer')
export class Footer extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly analyticsService = core.getService(AnalyticsService);
  private readonly experimentService = core.getService(ExperimentService);
  private readonly participantService = core.getService(ParticipantService);
  private readonly routerService = core.getService(RouterService);

  @property() disabled = false;
  @property() showNextButton = true;
  @property() onNextClick: () => void = () => {};

  @state() isLoadingNext = false;

  override render() {
    return html`
      <div class="left">
        <slot></slot>
      </div>
      <div class="right">${this.renderNextStageButton()}</div>
    `;
  }

  private renderEndExperimentButton() {
    if (!this.participantService.isLastStage) {
      return nothing;
    }

    const handleNext = async () => {
      this.isLoadingNext = true;
      // Track click
      this.analyticsService.trackButtonClick(ButtonClick.STAGE_NEXT);

      // Handle custom onNextClick
      await this.onNextClick();
      
      // Save last stage and mark experiment as completed
      await this.participantService.completeLastStage();
      await this.participantService.routeToEndExperiment(ParticipantStatus.SUCCESS);

      this.isLoadingNext = false;
    };

    const preventNextClick = this.disabled || this.participantService.disableStage;
    return html`
      <pr-button
        variant=${this.disabled ? 'default' : 'tonal'}
        ?disabled=${preventNextClick}
        ?loading=${this.isLoadingNext}
        @click=${handleNext}
      >
        Save and complete experiment
      </pr-button>
    `;
  }

  private renderNextStageButton() {
    if (!this.showNextButton) {
      return nothing;
    }

    // If last stage, end experiment
    if (this.participantService.isLastStage()) {
      return this.renderEndExperimentButton();
    }

    const handleNext = async () => {
      this.isLoadingNext = true;
      // Handle custom onNextClick
      await this.onNextClick();
      // Progress to next stage
      const nextStageId = await this.participantService.progressToNextStage() ?? '';
      // Navigate to new stage
      if (!this.participantService.profile) return false;
      this.routerService.navigate(Pages.PARTICIPANT_STAGE, {
        experiment: this.routerService.activeRoute.params['experiment'],
        participant: this.routerService.activeRoute.params['participant'],
        stage: nextStageId,
      });
      this.isLoadingNext = false;
    };

    const preventNextClick = this.disabled || this.participantService.disableStage;

    return html`
      <pr-button
        variant=${this.disabled ? 'default' : 'tonal'}
        ?disabled=${preventNextClick}
        ?loading=${this.isLoadingNext}
        @click=${handleNext}
      >
        Next stage
      </pr-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'stage-footer': Footer;
  }
}
