import '../../pair-components/button';
import '../../pair-components/icon';
import '../../pair-components/icon_button';

import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';

import {core} from '../../core/core';
import {AuthService} from '../../services/auth.service';
import {HomeService} from '../../services/home.service';
import {Pages, RouterService} from '../../services/router.service';

import {
  StageConfig
} from '@deliberation-lab/utils';
import {ExperimentEditor} from '../../services/experiment.editor';

import {styles} from './experiment_builder_nav.scss';

/** Sidenav for experiment builder */
@customElement('experiment-builder-nav')
export class ExperimentBuilderNav extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly experimentEditor = core.getService(ExperimentEditor);

  override render() {

    return html`
      <pr-button
        color="primary"
        variant="tonal"
        @click=${() => { this.experimentEditor.toggleStageBuilderDialog() }}
      >
        Add new stage
      </pr-button>
      ${this.renderMetadataItem()}
      ${this.experimentEditor.stages.map(
        (stage, index) => this.renderStageItem(stage, index)
      )}
    `;
  }

  private renderMetadataItem() {
    const navItemClasses = classMap({
      'nav-item': true,
      selected: this.experimentEditor.currentStageId === undefined,
    });

    return html`
      <div
        class=${navItemClasses}
        role="button"
        @click=${() => { this.experimentEditor.setCurrentStageId(undefined) }}
      >
        <pr-icon icon="settings"></pr-icon>
        <div class="primary">Settings</div>
      </div>
    `;
  }

  private renderStageItem(stage: StageConfig, index: number) {
    const navItemClasses = classMap({
      'nav-item': true,
      selected: this.experimentEditor.currentStageId === stage.id,
    });

    const handleMoveUp = (e: Event) => {
      this.experimentEditor.moveStageUp(index);
      e.stopPropagation();
    };

    const handleMoveDown = (e: Event) => {
      this.experimentEditor.moveStageDown(index);
      e.stopPropagation();
    };

    const handleDelete = () => {
      this.experimentEditor.deleteStage(index);
    };

    return html`
      <div class="nav-item-wrapper">
        <div
          class=${navItemClasses}
          role="button"
          @click=${() => { this.experimentEditor.setCurrentStageId(stage.id) }}
        >
          ${index + 1}. ${stage.name}
        </div>
        <div class="buttons">
          <pr-icon-button
            color="neutral"
            icon="arrow_upward"
            padding="small"
            size="small"
            variant="default"
            ?disabled=${index === 0}
            @click=${handleMoveUp}
          >
          </pr-icon-button>
          <pr-icon-button
            color="neutral"
            icon="arrow_downward"
            padding="small"
            size="small"
            variant="default"
            ?disabled=${index === this.experimentEditor.stages.length - 1}
            @click=${handleMoveDown}
          >
          </pr-icon-button>
          <pr-icon-button
            color="error"
            icon="delete"
            padding="small"
            size="small"
            variant="default"
            @click=${handleDelete}
          >
          </pr-icon-button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'experiment-builder-nav': ExperimentBuilderNav;
  }
}