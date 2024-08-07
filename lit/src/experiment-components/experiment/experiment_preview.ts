import '../../pair-components/button';
import '../../pair-components/icon_button';
import '../../pair-components/tooltip';

import '../profile/profile_preview';

import {MobxLitElement} from '@adobe/lit-mobx';
import {ParticipantProfile} from '@llm-mediation-experiments/utils';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {convertUnifiedTimestampToDate} from '../../shared/utils';

import {core} from '../../core/core';
import {AuthService} from '../../services/auth_service';
import {ExperimentConfigService} from '../../services/config/experiment_config_service';
import {ExperimentService} from '../../services/experiment_service';
import {ExperimenterService} from '../../services/experimenter_service';
import {ParticipantService} from '../../services/participant_service';
import {Pages, RouterService} from '../../services/router_service';

import {PARTICIPANT_COMPLETION_TYPE} from '@llm-mediation-experiments/utils';
import {styles} from './experiment_preview.scss';

/** Experiment preview */
@customElement('experiment-preview')
export class ExperimentPreview extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly authService = core.getService(AuthService);
  private readonly experimentService = core.getService(ExperimentService);
  private readonly experimenterService = core.getService(ExperimenterService);
  private readonly participantService = core.getService(ParticipantService);

  private readonly routerService = core.getService(RouterService);
  private readonly experimentConfig = core.getService(ExperimentConfigService);

  /** Copy a link to this participant's experiment view to the clipboard */
  async copyExperimentLink() {
    const basePath = window.location.href.substring(
      0,
      window.location.href.indexOf('/#')
    );
    const link = `${basePath}/#/${this.experimentService.experiment?.id}/`;

    await navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
  }

  override render() {
    const joinExperiment = () => {
      const prolificIdMatch = window.location.href.match(
        /[?&]PROLIFIC_PID=([^&]+)/
      );
      const participantProfile: Partial<ParticipantProfile> = {};
      participantProfile.prolificId = prolificIdMatch
        ? prolificIdMatch[1]
        : null;

      if (
        this.experimentService.experiment?.prolificRedirectCode &&
        !prolificIdMatch
      ) {
        console.log(
          'Warning: Participant joining a Prolific experiment without a Prolific code.'
        );
      }
      this.experimentService.join(participantProfile);
    };

    // Nuance: Add feature where, if experiment is in a group with a lobby, disallow joining
    // directly.
    if (!this.authService.isExperimenter) {
      if (this.experimentService.canAddParticipant()) {
        return html`
          <div class="row">
            <pr-button
              color="tertiary"
              variant="tonal"
              @click=${joinExperiment}
            >
              Join experiment
            </pr-button>
          </div>
        `;
      } else {
        return `Unable to join this experiment. Reach out to your administrator if you think this is in error.`;
      }
    }

    const getTransferableExperiments = () => {
      // Only allow transferring from the lobby.
      if (!this.experimentService.experiment?.lobbyConfig.isLobby) {
        return [];
      }
      // Ony fetch other, non-lobby experiments.
      return this.experimenterService
        .getExperimentsInGroup(group)
        .filter((experiment) => !experiment.lobbyConfig.isLobby)
        .filter(
          (experiment) =>
            !experiment.participantConfig.numberOfMaxParticipants ||
            experiment.numberOfParticipants <
              experiment.participantConfig.numberOfMaxParticipants
        );
    };

    const group = this.experimentService.experiment?.group!;
    const participants = this.experimentService.privateParticipants;
    const currentParticipants = participants.filter(
      (participant) =>
        !participant.transferConfig && !participant.completedExperiment
    );

    const transferredParticipants = this.experimentService.experiment
      ?.lobbyConfig.isLobby
      ? participants.filter(
          (participant) =>
            (participant.completionType &&
              participant.completionType ===
                PARTICIPANT_COMPLETION_TYPE.SUCCESS) ||
            (!participant.completionType && participant.transferConfig)
        )
      : [];

    const failedParticipants = participants.filter(
      (participant) =>
        (participant.completionType &&
          participant.completionType !== PARTICIPANT_COMPLETION_TYPE.SUCCESS) ||
        (!participant.completionType &&
          this.experimentService.experiment?.lobbyConfig.isLobby &&
          participant.completedExperiment &&
          !participant.transferConfig)
    );
    const completedParticipants = this.experimentService.experiment?.lobbyConfig
      .isLobby
      ? []
      : participants.filter(
          (participant) =>
            participant.completionType ===
              PARTICIPANT_COMPLETION_TYPE.SUCCESS ||
            (!participant.completionType && participant.completedExperiment)
        );

    const experiment = this.experimentService.experiment;
    return html`
      <div class="top-bar">
        <div class="left">
          <div class="stat small">
            ${experiment?.publicName
              ? html`Public experiment name: ${experiment?.publicName} <br />`
              : ''}
            ${experiment?.author && experiment?.author.displayName
              ? html`Author: ${experiment?.author.displayName} <br />`
              : ''}
            Create time: ${convertUnifiedTimestampToDate(experiment?.date!)}
            <br />

            Number of participants: ${experiment?.numberOfParticipants}<br />
            ${experiment?.participantConfig
              ? html`
                  Maximum number of participants:
                  ${experiment?.participantConfig.numberOfMaxParticipants! > 0
                    ? experiment?.participantConfig.numberOfMaxParticipants
                    : 'unrestricted'}
                  <br />
                  Wait for all to start:
                  ${experiment?.participantConfig.waitForAllToStart}
                  <br />
                `
              : ''}
            ${experiment?.prolificRedirectCode
              ? html`
                  Prolific redirect code: ${experiment?.prolificRedirectCode}
                  ${experiment.attentionCheckConfig
                    ?.prolificAttentionFailRedirectCode
                    ? html`, failed redirect code:
                      ${experiment.attentionCheckConfig
                        ?.prolificAttentionFailRedirectCode}`
                    : ''}
                  <br />
                `
              : ''}
            ${experiment?.attentionCheckConfig
              ? html`${experiment.attentionCheckConfig.waitSeconds
                  ? html`
                      Attention check parameters:
                      ${experiment.attentionCheckConfig.waitSeconds !==
                      undefined
                        ? html`${experiment.attentionCheckConfig.waitSeconds}
                          seconds wait, `
                        : ''}
                      ${experiment.attentionCheckConfig.popupSeconds !==
                      undefined
                        ? html`${experiment.attentionCheckConfig.popupSeconds}
                            popup seconds<br />`
                        : ''}
                    `
                  : ''}`
              : ''}
            ${experiment?.lobbyConfig.isLobby
              ? html`<br />This experiment is a lobby.
                  ${experiment?.lobbyConfig.waitSeconds
                    ? html`Participants will wait up to
                      ${experiment?.lobbyConfig.waitSeconds} seconds.`
                    : 'Participants will wait in the lobby indefinitely.'}`
              : ''}
          </div>
          ${this.renderGroup()}
        </div>
        <div class="right">
          ${this.renderShare()} ${this.renderFork()}
          ${this.renderAddParticipant()} ${this.renderDelete()}
          ${this.renderData()}
        </div>
      </div>
      <div class="row">${experiment?.description}</div>

      ${currentParticipants.length > 0
        ? html`<h2>${currentParticipants.length} current participants</h2>
            <div class="profile-wrapper">
              ${currentParticipants.map(
                (participant) =>
                  html`
                    <profile-preview
                      .profile=${participant}
                      .availableTransferExperiments=${getTransferableExperiments()}
                    >
                    </profile-preview>
                  `
              )}
            </div>`
        : ''}
      ${completedParticipants.length > 0
        ? html`
            <h2>${completedParticipants.length} completed participants</h2>
            <div class="profile-wrapper">
              ${completedParticipants.map(
                (participant) => html`
                  <profile-preview .profile=${participant}></profile-preview>
                `
              )}
            </div>
          `
        : ''}
      ${transferredParticipants.length > 0
        ? html`
            <h2>${transferredParticipants.length} transferred participants</h2>
            <div class="profile-wrapper">
              ${transferredParticipants.map(
                (participant) => html`
                  <profile-preview .profile=${participant}></profile-preview>
                `
              )}
            </div>
          `
        : ''}
      ${failedParticipants.length > 0
        ? html`
            <h2>${failedParticipants.length} failed participants</h2>
            <div class="profile-wrapper">
              ${failedParticipants.map(
                (participant) => html`
                  <profile-preview .profile=${participant}></profile-preview>
                `
              )}
            </div>
          `
        : ''}
    `;
  }

  private renderGroup() {
    if (
      !this.experimentService.experiment ||
      !this.experimentService.experiment.group
    ) {
      return nothing;
    }

    const navigateToGroup = () => {
      if (this.experimentService.experiment!.group) {
        this.routerService.navigate(Pages.EXPERIMENT_GROUP, {
          experiment_group: this.experimentService.experiment!.group,
        });
        this.authService.setEditPermissions(false);
      }
    };

    return html`
      <div class="stat small">
        <div>Group:</div>
        <div class="chip" role="button" @click=${navigateToGroup}>
          ${this.experimentService.experiment.group}
        </div>
      </div>
    `;
  }

  private renderAddParticipant() {
    if (!this.authService.canEdit) {
      return nothing;
    }

    const onAddParticipant = () => {
      // Can't add Prolific IDs this way.
      if (this.experimentService.canAddParticipant()) {
        this.experimenterService.createParticipant(this.experimentService.id!);
      } else {
        alert(
          'Number of maximum participants has been reached for this experiment.'
        );
      }
    };

    return html`
      <pr-tooltip text="Add participant" position="BOTTOM_END">
        <pr-icon-button
          icon="person_add"
          color="success"
          variant="default"
          @click=${onAddParticipant}
        >
        </pr-icon-button>
      </pr-tooltip>
    `;
  }

  private renderDelete() {
    if (!this.authService.canEdit) {
      return nothing;
    }

    const onDelete = () => {
      this.experimenterService.deleteExperiment(this.experimentService.id!);
      this.routerService.navigate(Pages.HOME);
      this.authService.setEditPermissions(false);
    };

    return html`
      <pr-tooltip text="Delete experiment" position="BOTTOM_END">
        <pr-icon-button
          icon="delete"
          color="error"
          variant="default"
          @click=${onDelete}
        >
        </pr-icon-button>
      </pr-tooltip>
    `;
  }

  private renderData() {
    const onClick = () => {
      this.routerService.navigate(Pages.DATA_EXPERIMENT, {
        experiment: this.experimentService.id!,
      });
    };

    return html`
      <pr-button color="tertiary" variant="tonal" @click=${onClick}>
        <div class="pr-button-inner">
          <pr-icon
            icon="analytics"
            color="tertiary"
            variant="default"
          ></pr-icon>
          <div>Data analysis</div>
        </div>
      </pr-button>
    `;
  }

  private renderShare() {
    const onFork = () => {
      const name = this.experimentService.experiment?.name!;
      const num = this.experimentService.experiment?.numberOfParticipants!;
      const stages = this.experimentService.stageIds.map(
        (stageId) => this.experimentService.stageConfigMap[stageId]
      );

      this.experimentConfig.updateName(name);
      this.experimentConfig.updateNumParticipants(num);
      this.experimentConfig.updateStages(stages);

      this.routerService.navigate(Pages.EXPERIMENT_CREATE);
    };

    return html`
      <pr-tooltip text="Copy link to join experiment" position="BOTTOM_END">
        <pr-icon-button
          icon="share"
          color="primary"
          variant="tonal"
          @click=${this.copyExperimentLink}
        >
        </pr-icon-button>
      </pr-tooltip>
    `;
  }

  private renderFork() {
    const onFork = () => {
      const name = this.experimentService.experiment?.name!;
      const stages = this.experimentService.stageIds.map(
        (stageId) => this.experimentService.stageConfigMap[stageId]
      );

      this.experimentConfig.updateName(name);
      this.experimentConfig.updateNumParticipants(0);
      this.experimentConfig.updateStages(stages);

      this.routerService.navigate(Pages.EXPERIMENT_CREATE);
    };

    return html`
      <pr-tooltip text="Fork experiment" position="BOTTOM_END">
        <pr-icon-button
          icon="fork_right"
          color="primary"
          variant="tonal"
          @click=${onFork}
        >
        </pr-icon-button>
      </pr-tooltip>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'experiment-preview': ExperimentPreview;
  }
}
