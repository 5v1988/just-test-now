import { Page, expect } from "@playwright/test";
import { Assert } from "./types/test.types";
import compareImage from 'looks-same';
import chalk from 'chalk';
import { delay, readSnapshot } from "../lib/utils";
import { Step } from "./types/report.types";
import YAML from 'json-to-pretty-yaml';

export default class Asserter {

    private asserts: Assert[]
    private driver: Page;

    constructor(page: Page, asserts: Assert[]) {
        this.asserts = asserts;
        this.driver = page;
    }

    async transformLocators(locators: Map<string, string>) {
        if (!this.asserts)
            return;
        this.asserts.forEach(async assert => {
            if (locators.has(assert.locator)) {
                console.log(chalk.green('Transforming locator: ', chalk.white.bgRed.bold('%s'), ' with ',
                    chalk.white.bgRed.bold('%s')), assert.locator, locators.get(assert.locator));
                assert.locator = locators.get(assert.locator)!;
            }
        });
    }

    async assert(): Promise<Step[]> {
        const startTime = new Date().getTime();
        const results: Step[] = [];
        if (!this.asserts)
            return [];

        for (const assert of this.asserts) {
            const stepResult: Step = {
                name: `— ${assert.name}  `,
                keyword: 'Assert ',
                result: {
                    status: 'undetermined',
                    duration: 0
                },
                embeddings: Array.of({
                    data: YAML.stringify(assert),
                    mime_type: 'text/plain'
                })
            };
            console.log(chalk.green(' Performing the assert : ', chalk.bold.bgYellow.white('%s')),
                assert.name);
            if (assert.pause) {
                console.log(chalk.yellow('Pausing for ', chalk.bold('%s'), ' seconds'),
                    assert.pause);
                await delay(assert.pause);
                console.log(chalk.green(' Resuming after pausing ', chalk.bold('%s'), ' seconds'),
                    assert.pause);
            }
            await this.driver.waitForLoadState('networkidle');

            let element;
            if (assert.role) {
                if (!assert.text)
                    throw new Error(`The key: text should be required when using role. Please check once.`);
                element = this.driver.getByRole(assert.role, { name: new RegExp(assert.text.trim(), "i") });
            } else if (assert.text) {
                element = this.driver.getByText(assert.text);
            } else {
                element = this.driver.locator(assert.locator);
            }

            try {
                switch (assert.type) {
                    case 'standard':
                        switch (assert.state) {
                            case 'visible':
                                await expect(element).toBeVisible({ timeout: 10000 });
                                break;
                            case 'invisible':
                                await expect(element).toBeVisible({ visible: false });
                                break;
                            case 'enabled':
                                await expect(element).toBeEnabled();
                                break;
                            case 'disabled':
                                await expect(element).toBeDisabled();
                                break;
                            case 'checked':
                                await expect(element).toBeChecked();
                                break;
                            case 'unchecked':
                                await expect(element).toBeChecked({ checked: false });
                                break;
                            case 'containText':
                                await expect(element).toContainText(assert.text);
                                break;
                        }
                        break;

                    case 'snapshot':
                        const original = await readSnapshot(assert.original);
                        stepResult.embeddings!.push({
                            data: original,
                            mime_type: 'image/png'
                        });
                        const { equal } = await compareImage(assert.original, assert.reference);
                        expect(equal).toBeTruthy();
                        break;

                    // case 'text':
                    //     switch (assert.state) {
                    //         case 'visible':
                    //             await expect(this.driver.getByText(assert.text, { exact: false }))
                    //                 .toBeVisible({ timeout: 10000 });
                    //             break;
                    //         case 'invisible':
                    //             await expect(this.driver.getByText(assert.text, { exact: false }))
                    //                 .toBeVisible({ visible: false, timeout: 10000 });
                    //             break;
                    //     }
                    //     break;
                    default:
                        throw new Error(`No such assertion: '${assert.type}'. Please check for typo.`);
                }
                stepResult.result.status = 'passed';
            } catch (error) {
                stepResult.result.status = 'failed';
            }
            const elaspedTime = new Date().getTime() - startTime;
            stepResult.result.duration = elaspedTime;
            results.push(stepResult);
        }
        return results;
    }
}