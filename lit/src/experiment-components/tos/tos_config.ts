import "../../pair-components/textarea";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html } from "lit";
import { customElement } from "lit/decorators.js";

import { core } from "../../core/core";
import { TOSConfigService } from "../../services/config/tos_config_service";

import { styles } from "./tos_config.scss";

/** TOS config */
@customElement("tos-config")
export class TOSConfig extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly tosConfig = core.getService(TOSConfigService);

  override render() {
    const handleNameInput = (e: Event) => {
      const value = (e.target as HTMLTextAreaElement).value;
      this.tosConfig.updateName(value);
    };

    const handleDescriptionInput = (e: Event) => {
      const value = (e.target as HTMLTextAreaElement).value;
      this.tosConfig.updateDescription(value);
    };

    const handlePopupText = (e: Event) => {
      const value = (e.target as HTMLTextAreaElement).value;
      this.tosConfig.updatePopupText(value);
    };

    const handleContentInput = (e: Event) => {
      const value = (e.target as HTMLTextAreaElement).value;
      this.tosConfig.updateContent(value);
    };

    return html`
      <pr-textarea
        label="Stage name"
        placeholder="Stage name"
        variant="outlined"
        .value=${this.tosConfig.name}
        @input=${handleNameInput}
      >
      </pr-textarea>
      
      <pr-textarea
        label="Stage description"
        placeholder="Stage description"
        variant="outlined"
        .value=${this.tosConfig.description}
        @input=${handleDescriptionInput}
      >
      </pr-textarea>
 
      <pr-textarea
        label="Info icon pop-up text"
        placeholder="Info icon pop-up text (markdown supported)"
        variant="outlined"
        .value=${this.tosConfig.popupText}
        @input=${handlePopupText}
      >
      </pr-textarea>
      
      <pr-textarea
        label="Content (in Git-Flavored Markdown)"
        placeholder="Add Markdown terms of service here"
        variant="outlined"
        .value=${this.tosConfig.content}
        @input=${handleContentInput}
      >
      </pr-textarea>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tos-config": TOSConfig;
  }
}
