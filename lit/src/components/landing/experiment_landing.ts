import "../../pair-components/button";
import "../../pair-components/icon_button";
import "../../pair-components/tooltip";

import "./experiment_card";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";

import { Experiment, ExperimentTemplate } from '@llm-mediation-experiments/utils';
import { convertUnifiedTimestampToDate } from '../../shared/utils';

import { core } from "../../core/core";
import { AuthService } from "../../services/auth_service";
import { ExperimentConfigService } from "../../services/config/experiment_config_service";
import { Pages, RouterService } from "../../services/router_service";


import { ExperimenterService } from "../../services/experimenter_service";
import { styles } from "./experiment_landing.scss";

/** Experiment landing component */
@customElement("experiment-landing-page")
export class ExperimentLanding extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly authService = core.getService(AuthService);
  private readonly routerService = core.getService(RouterService);
  private readonly experimenterService = core.getService(ExperimenterService);
  private readonly experimentConfig = core.getService(ExperimentConfigService);

  override render() {
    if (!this.authService.isExperimenter) {
      return html`<div>403: Participants do not have access</div>`;
    }

    const ungroupedExperiments = this.experimenterService.getUngroupedExperiments();
    const groupedExperiments = this.experimenterService.getGroupedExperimentsMap();
    return html`
      <h2>Experiments (Ungrouped)</h2>
      <div class="cards-wrapper">
        ${ungroupedExperiments.length === 0 ?
          html`<div class="label">No experiments yet</div>` : nothing}
        ${ungroupedExperiments.map(
          experiment => html`<experiment-card .experiment=${experiment}></experiment-card>`
        )}
      </div>
      <h2>Experiment groups</h2>
      <div class="cards-wrapper">
        ${groupedExperiments.size === 0 ?
          html`<div class="label">No experiment groups yet</div>` : nothing}
            ${Array.from(groupedExperiments.entries()).map(
      ([group, experiments]) => this.renderExperimentGroupCard(group, experiments)
    )}
      </div>
      <h2>Templates</h2>
      <div class="cards-wrapper">
        ${this.experimenterService.templates.length === 0 ?
          html`<div class="label">No templates yet</div>` : nothing}
        ${this.experimenterService.templates.map(
          template => this.renderTemplateCard(template)
        )}
      </div>
    `;
  }

  private renderExperimentGroupCard(group: string, experiments: Experiment[]) {
    const handleClick = () => {
      this.routerService.navigate(
        Pages.EXPERIMENT_GROUP,
        { "experiment_group": group }
      );
      this.authService.setEditPermissions(false);
    }

    const displayName = experiments.length > 0 ? experiments[0].name.split('_')[0] : '';

    return html`
      <div class="card">
        <div class="header">
          <div class="left">
            <h3>${displayName}</h3>
            <div class="subtitle">${group}</div>
          </div>
          <div class="right">
            <pr-tooltip text="View group" position="TOP_END">
              <pr-icon-button
                icon="arrow_forward"
                color="secondary"
                variant="default"
                @click=${handleClick}>
              </pr-icon-button>
            </pr-tooltip>
          </div>

          ${this.authService.canEdit ? this.renderDeleteGroupButton(experiments) : nothing}
        </div>

        <div>
          <p>${experiments.length} experiments</p>
          <div class="label">
            <div>${experiments[0].author?.displayName ?? ''}</div>
            <small>${convertUnifiedTimestampToDate(experiments[0].date)}</small>
          </div>
        </div>
      </div>
    `;
  }

  private renderDeleteGroupButton(experiments: Experiment[]) {
    const handleDelete = () => {
      experiments.forEach(experiment => {
        this.experimenterService.deleteExperiment(experiment.id);
      });
    };

    return html`
      <pr-tooltip text="Delete experiments in group" position="BOTTOM_END">
        <pr-icon-button
          icon="delete"
          color="error"
          variant="default"
          @click=${handleDelete}>
        </pr-icon-button>
      </pr-tooltip>
    `;
  }

  private renderTemplateCard(template: ExperimentTemplate) {
    const handleClick = () => {
      this.experimentConfig.loadTemplate(template.id, template);
      this.routerService.navigate(Pages.EXPERIMENT_CREATE);
    }

    return html`
      <div class="card">
        <h3>${template.name}</h3>
        <p class="label">ID: ${template.id}</p>
        <p>${template.description}</p>
        <div class="action-buttons">
          <pr-button variant="default" @click=${handleClick}>
            Use template
          </pr-button>
          ${this.authService.canEdit ? this.renderDeleteTemplate(template) : nothing}
        </div>
      </div>
    `;
  }

  private renderDeleteTemplate(template: ExperimentTemplate) {
    const handleDelete = () => {
      this.experimenterService.deleteTemplate(template.id);
    };

    return html`
      <pr-tooltip text="Delete template" position="BOTTOM_END">
        <pr-icon-button
          icon="delete"
          color="error"
          variant="default"
          @click=${handleDelete}>
        </pr-icon-button>
      </pr-tooltip>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "experiment-landing-page": ExperimentLanding;
  }
}
