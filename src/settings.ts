import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import CompositeCard = formattingSettings.CompositeCard;
import SimpleCard = formattingSettings.SimpleCard;
import Model = formattingSettings.Model;

class TextGroup extends SimpleCard {
    public name: string = "textGroup";
    public displayName: string = "Visual description";

    public collapsible: boolean = false;
    public text = new formattingSettings.ReadOnlyText({
        name: "description",
        value: "Visual to test launchUrl and webAccess capabilities"
    });

    slices?: formattingSettings.Slice[] = [this.text];
}

class ImageGroup extends SimpleCard {
    public name: string = "dogGroup";
    public displayName: string = "Image settings";

    public useDogs = new formattingSettings.ToggleSwitch({
        name: "dogs",
        displayName: "Show dogs",
        value: false
    });

    slices?: formattingSettings.Slice[] = [this.useDogs];
}

export class DescriptionCard extends CompositeCard {
    public name: string = "general";
    public displayName: string = "General settings";
    public collapsible: boolean = false;

    public text = new TextGroup();
    public image = new ImageGroup();

    groups: SimpleCard[] = [this.text, this.image];
}

export class Settings extends Model {
    public description = new DescriptionCard();
    cards: formattingSettings.Cards[] = [this.description];
}