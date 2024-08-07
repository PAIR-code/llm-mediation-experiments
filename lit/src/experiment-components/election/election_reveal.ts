import "../profile/profile_avatar";
import "../progress/progress_stage_completed";
import "../progress/progress_stage_waiting";

import '@material/web/radio/radio.js';

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import {
  StageKind,
} from "@llm-mediation-experiments/utils";

import { core } from "../../core/core";
import { ExperimentService } from "../../services/experiment_service";
import { RouterService } from "../../services/router_service";

import { styles } from "./election_reveal.scss";

/** Election reveal */
@customElement("election-reveal")
export class ElectionReveal extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly experimentService = core.getService(ExperimentService);
  private readonly routerService = core.getService(RouterService);

  @property() voteStageId = "";

  override render() {
    const stage = this.experimentService.publicStageDataMap[this.voteStageId];

    if (stage?.kind !== StageKind.VoteForLeader) {
      return nothing;
    }

    const currentStage = this.routerService.activeRoute.params["stage"];
    const { ready, notReady } =
      this.experimentService.getParticipantsReadyForStage(currentStage);

    if (notReady.length > 0) {
      return html`
        <progress-stage-waiting .stageId=${currentStage}>
        </progress-stage-waiting>
      `;
    }

    const leaderPublicId = stage.currentLeader ?? "";
    const leader = this.experimentService.getParticipantProfile(leaderPublicId);

    if (leader === undefined) {
      return nothing;
    }

    return html`
      <div class="reveal-wrapper">
        <h2>The winner of the election is:</h2>
        <div class="reveal">
          <profile-avatar .emoji=${leader.avatarUrl} .square=${true}>
          </profile-avatar>
          <div class="info">
            <div class="title">${leader.name}</div>
            <div class="subtitle">(${leader.pronouns})</div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "election-reveal": ElectionReveal;
  }
}
