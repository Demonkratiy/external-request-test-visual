/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import { builtinRules } from "eslint/use-at-your-own-risk";

interface IButton {
    textContent: string;
    url: string;
    useLaunchUrl: boolean;
    useLabel?: boolean;
    useImage?: boolean;
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private root: HTMLElement;

    private host: IVisualHost;

    public static className: string = "launchUrlVisual";
    public static documentationUrl: string = "https://learn.microsoft.com/en-us/power-bi/developer/visuals/launch-url";
    public static catUrl: string = "https://api.thecatapi.com/v1/images/search";
    public static buttons: IButton[] = [
        { textContent: "Launch URL", url: Visual.documentationUrl, useLaunchUrl: true },
        { textContent: "WITHOUT Web Access", url: Visual.documentationUrl, useLaunchUrl: false, useLabel: true },
        { textContent: "WITH Web Access", url: Visual.catUrl, useLaunchUrl: false, useImage: true },
    ];


    public static createVisualElements(host: IVisualHost): HTMLDivElement {
        const root = document.createElement("div");
        root.classList.add(Visual.className);

        const container = document.createElement("div");
        container.id = "container";

        const label = document.createElement("label");
        const image = document.createElement("img");

        Visual.buttons.forEach((button) => {
            const newButton = Visual.createButton(button, host, label, image);
            container.appendChild(newButton);
            if (button.useLabel) {
                container.appendChild(label);
            }
            if (button.useImage) {
                container.appendChild(image);
            }
        });

        root.appendChild(container);
        return root;
    }

    public static createButton(button: IButton, host: IVisualHost, label?: HTMLElement, image?: HTMLImageElement): HTMLButtonElement {
        const newButton = document.createElement("button");
        newButton.textContent = button.textContent;
        newButton.addEventListener("click", async () => {
            try {
                if (button.useLaunchUrl) {
                    host.launchUrl(button.url);
                    return;
                }

                const response = await fetch(button.url);
                const data = await response.json();

                if (button.useImage) {
                    image.src = data[0].url;
                    image.style.maxWidth = "200px";
                    image.style.maxHeight = "200px";
                    image.style.display = "block";
                    image.style.marginTop = "10px";
                }


            } catch (error) {
                label.textContent = "Request was blocked";
            }
        });

        return newButton;
    }

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.host = options.host;

        this.root = Visual.createVisualElements(this.host);
        this.target.append(this.root);
    }

    public update(options: VisualUpdateOptions) {
    }
}