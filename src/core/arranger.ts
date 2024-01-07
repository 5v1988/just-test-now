import {
    Page,
} from "@playwright/test";
import { Arrange } from "./types";

export default class Arranger {

    private arranges: Arrange[]
    private driver: Page;

    constructor(page: Page, arranges: Arrange[]) {
        this.arranges = arranges;
        this.driver = page;
    }

    async arrange() {
        for (let arrange of this.arranges) {
            switch (arrange.name) {
                case 'open_url':
                    await this.driver.goto(arrange.base_url);
                    break;
            }
        }
    }
}