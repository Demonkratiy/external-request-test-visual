import powerbi from "powerbi-visuals-api";
import IEnumMember = powerbi.IEnumMember;

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import CompositeCard = formattingSettings.CompositeCard;
import SimpleCard = formattingSettings.SimpleCard;
import Model = formattingSettings.Model;

export const RANDOM_BREED: string = "random";

const breedItems: IEnumMember[] = [
    { value: RANDOM_BREED, displayName: "Any breed" },
    { value: "husky", displayName: "Husky" },
    { value: "beagle", displayName: "Beagle" },
    { value: "akita", displayName: "Akita" },
    { value: "boxer", displayName: "Boxer" },
    { value: "basenji", displayName: "Basenji" },
];

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
    public name: string = "imageGroup";
    public displayName: string = "Image settings";

    public breed = new formattingSettings.ItemDropdown({
        name: "breed",
        displayName: "Breed",
        items: breedItems,
        value: breedItems[0]
    });

    slices?: formattingSettings.Slice[] = [this.breed];
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