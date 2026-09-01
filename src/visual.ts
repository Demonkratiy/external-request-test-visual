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
import IViewport = powerbi.IViewport;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

import { RANDOM_BREED, Settings } from "./settings";

const enum ScenarioKind {
    LaunchUrl,
    BlockedFetch,
    AllowedFetchWithImage,
}

const enum StatusState {
    Idle = "idle",
    Pending = "pending",
    Success = "success",
    Failure = "failure",
}

interface IScenario {
    textContent: string;
    kind: ScenarioKind;
}

const enum FetchResultKind {
    Ok = "ok",
    Rejected = "rejected",
    HttpError = "httpError",
    BadJson = "badJson",
    BadShape = "badShape",
}

interface IFetchSuccess {
    kind: FetchResultKind.Ok;
    imageUrl: string;
    imageOrigin: string;
}

interface IFetchFailure {
    kind: FetchResultKind.Rejected | FetchResultKind.HttpError | FetchResultKind.BadJson | FetchResultKind.BadShape;
    reason: string;
}

type FetchResult = IFetchSuccess | IFetchFailure;

export class Visual implements IVisual {
    private target: HTMLElement;
    private root: HTMLElement;
    private container: HTMLElement;

    private host: IVisualHost; 
    private formattingSettingsService: FormattingSettingsService; 
    private settings: Settings = new Settings();

    public static className: string = "externalRequestTestVisual";
    public static documentationUrl: string = "https://learn.microsoft.com/en-us/power-bi/developer/visuals/launch-url";
    /** Whitelisted in capabilities.json; serves its images from images.dog.ceo, a subdomain of the same domain. */
    public static dogApiUrl: string = "https://dog.ceo/api/breeds/image/random";
    public static dogApiBreedUrl: string = "https://dog.ceo/api/breed/{breed}/images/random";
    /** Deliberately NOT whitelisted, and returns Access-Control-Allow-Origin: * so a failure isolates WebAccess from CORS. */
    public static nonWhitelistedApiUrl: string = "https://api.thecatapi.com/v1/images/search";

    public static scenarios: IScenario[] = [
        { textContent: "Launch URL", kind: ScenarioKind.LaunchUrl },
        { textContent: "WITHOUT Web Access", kind: ScenarioKind.BlockedFetch },
        { textContent: "WITH Web Access", kind: ScenarioKind.AllowedFetchWithImage },
    ];

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService();

        this.root = document.createElement("div");
        this.root.classList.add(Visual.className);

        this.container = document.createElement("div");
        this.container.classList.add("container");
        this.root.appendChild(this.container);

        Visual.scenarios.forEach((scenario) => this.addScenario(scenario));
        this.target.append(this.root);
    }

    public update(options: VisualUpdateOptions) {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(Settings, options.dataViews?.[0]);
        this.updateElements(options.viewport);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }

    private addScenario(scenario: IScenario): void {
        const row = document.createElement("div");
        row.classList.add("scenario");

        const button = document.createElement("button");
        button.textContent = scenario.textContent;

        const requestStatus = Visual.createStatus();
        row.append(button, requestStatus);

        let run: () => void | Promise<void>;
        let reset: () => void = () => undefined;

        if (scenario.kind === ScenarioKind.AllowedFetchWithImage) {
            const imageStatus = Visual.createStatus();
            const image = document.createElement("img");
            image.classList.add("result-image");
            row.append(imageStatus, image);

            run = () => this.runAllowedFetch(requestStatus, imageStatus, image);
            reset = () => {
                Visual.setStatus(imageStatus, StatusState.Idle, "");
                Visual.hideImage(image);
            };
        } else if (scenario.kind === ScenarioKind.BlockedFetch) {
            run = () => Visual.runBlockedFetch(requestStatus);
        } else {
            run = () => this.runLaunchUrl(requestStatus);
        }

        button.addEventListener("click", async () => {
            button.disabled = true;
            Visual.setStatus(requestStatus, StatusState.Pending, "Running…");
            reset();

            try {
                await run();
            } catch (error) {
                reset();
                Visual.setStatus(requestStatus, StatusState.Failure, `Unexpected error — ${Visual.describe(error)}`);
            } finally {
                button.disabled = false;
            }
        });

        this.container.appendChild(row);
    }

    private runLaunchUrl(requestStatus: HTMLElement): void {
        try {
            this.host.launchUrl(Visual.documentationUrl);
            Visual.setStatus(requestStatus, StatusState.Success, "launchUrl() called — a new tab opens once you confirm the Power BI dialog");
        } catch (error) {
            Visual.setStatus(requestStatus, StatusState.Failure, `launchUrl() threw: ${Visual.describe(error)}`);
        }
    }

    /**
     * The URL is not whitelisted, so being rejected is the expected outcome — but a rejection alone cannot tell a
     * WebAccess block from a dead network, and any other failure proves the request did reach the server. A request
     * to the whitelisted origin therefore acts as the control that decides between "proven", "broken" and "unknown".
     */
    private static async runBlockedFetch(requestStatus: HTMLElement): Promise<void> {
        const blocked = await Visual.fetchImageUrl(Visual.nonWhitelistedApiUrl);
        if (blocked.kind !== FetchResultKind.Rejected) {
            const detail = blocked.kind === FetchResultKind.Ok ? "a response was returned" : blocked.reason;
            Visual.setStatus(requestStatus, StatusState.Failure, `Request reached the server — WebAccess did NOT block a non-whitelisted origin (${detail})`);
            return;
        }

        const control = await Visual.fetchImageUrl(Visual.dogApiUrl);
        if (control.kind === FetchResultKind.Rejected) {
            Visual.setStatus(requestStatus, StatusState.Idle, `Inconclusive — the whitelisted control request was rejected too, so the network is unavailable: ${control.reason}`);
            return;
        }

        Visual.setStatus(requestStatus, StatusState.Success, `Blocked as expected — ${blocked.reason}`);
    }

    private async runAllowedFetch(requestStatus: HTMLElement, imageStatus: HTMLElement, image: HTMLImageElement): Promise<void> {
        const outcome = await Visual.fetchImageUrl(this.getDogApiUrl());
        if (outcome.kind !== FetchResultKind.Ok) {
            Visual.setStatus(requestStatus, StatusState.Failure, `API request failed — ${outcome.reason}`);
            Visual.setStatus(imageStatus, StatusState.Idle, "Image not requested");
            return;
        }

        Visual.setStatus(requestStatus, StatusState.Success, "API request succeeded");
        Visual.setStatus(imageStatus, StatusState.Pending, "Loading image…");

        const loaded = await Visual.loadImage(image, outcome.imageUrl);
        if (loaded) {
            Visual.setStatus(imageStatus, StatusState.Success, "Image loaded");
        } else {
            Visual.hideImage(image);
            Visual.setStatus(imageStatus, StatusState.Failure, `Image blocked — ${outcome.imageOrigin} is not reachable`);
        }
    }

    private getDogApiUrl(): string {
        const breed = this.settings.description.image.breed.value.value as string;
        return !breed || breed === RANDOM_BREED
            ? Visual.dogApiUrl
            : Visual.dogApiBreedUrl.replace("{breed}", breed);
    }

    private static async fetchImageUrl(url: string): Promise<FetchResult> {
        let response: Response;
        try {
            response = await fetch(url);
        } catch (error) {
            return { kind: FetchResultKind.Rejected, reason: `request rejected (CSP or network): ${Visual.describe(error)}` };
        }

        if (!response.ok) {
            return { kind: FetchResultKind.HttpError, reason: `HTTP ${response.status} ${response.statusText}` };
        }

        let data: unknown;
        try {
            data = await response.json();
        } catch (error) {
            return { kind: FetchResultKind.BadJson, reason: `response is not valid JSON: ${Visual.describe(error)}` };
        }

        const imageUrl: unknown = (data as { message?: unknown })?.message;
        if (typeof imageUrl !== "string") {
            return { kind: FetchResultKind.BadShape, reason: "unexpected response shape: 'message' is not a URL string" };
        }

        let imageOrigin: string;
        try {
            imageOrigin = new URL(imageUrl).origin;
        } catch {
            return { kind: FetchResultKind.BadShape, reason: `unexpected response shape: 'message' is not a valid URL: ${imageUrl}` };
        }

        return { kind: FetchResultKind.Ok, imageUrl, imageOrigin };
    }

    /** A blocked image surfaces as an async error event, so it must be awaited rather than caught. */
    private static loadImage(image: HTMLImageElement, url: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const settle = (loaded: boolean) => {
                image.onload = null;
                image.onerror = null;
                resolve(loaded);
            };

            image.onload = () => settle(true);
            image.onerror = () => settle(false);
            image.src = url;
            image.classList.add("visible");
        });
    }

    private static hideImage(image: HTMLImageElement): void {
        image.classList.remove("visible");
        image.removeAttribute("src");
    }

    private static createStatus(): HTMLElement {
        const status = document.createElement("label");
        status.classList.add("status");
        return status;
    }

    private static setStatus(status: HTMLElement, state: StatusState, text: string): void {
        const marks: Record<string, string> = {
            [StatusState.Pending]: "… ",
            [StatusState.Success]: "✔ ",
            [StatusState.Failure]: "✘ ",
        };

        status.classList.remove(StatusState.Idle, StatusState.Pending, StatusState.Success, StatusState.Failure);
        status.classList.add(state);
        status.textContent = text ? `${marks[state] ?? ""}${text}` : "";
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }

    private updateElements(viewPort: IViewport) {
        this.container.style.width = `${viewPort.width}px`;
        this.container.style.height = `${viewPort.height}px`;
    }
}
