import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';
import { MdSnackBar } from '@angular/material';
import { ActivatedRoute, Params } from '@angular/router';

import * as _ from 'lodash';

import { TableService } from '../core/table.service';
import { DynamicFormComponent } from '../dynamic-form/dynamic-form.component';
import { FieldConfig } from '../dynamic-form/field-config.interface';

import { TableHeader, TableMeta } from '../common/responses';

@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html',
    styleUrls: ['form-host.component.scss']
})
export class FormHostComponent implements OnInit {
    @ViewChild(DynamicFormComponent)
    private form: DynamicFormComponent;

    public constructor(
        private backend: TableService,
        private route: ActivatedRoute,
        private snackBar: MdSnackBar
    ) { }

    public config: FieldConfig[] = [];
    public name: string;

    public ngOnInit() {
        this.route.params.subscribe(async (params: Params) => {
            this.name = params.name;
            let meta: TableMeta;
            try {
                meta = await this.backend.meta(this.name);
            } catch (e) {
                meta = null;
            }

            this.config = meta === null ? null : this.createConfigFor(meta);
        });
    }

    public async onFormSubmitted(form) {
        let message: string;
        try {
            await this.backend.submitRow(this.name, form);
            this.form.form.reset();
            message = "Created new row";
        } catch (e) {
            message = "Unable add row";
            
            // If the error originated from a bad HTTP request, the TableService
            // would have throw the response body, which would have the shape of
            // ErrorResponse
            if (e.message)
                message += ` (${e.message})`;
        }

        this.snackBar.open(message, undefined, { duration: 3000 });
    }

    private createConfigFor(meta: TableMeta): FieldConfig[] {
        const config = meta.headers.map((h: TableHeader): FieldConfig => {
            const type = h.enumValues !== null ? 'select' : 'input';

            // Default to string input
            let subtype = 'text';
            // 'boolean' type is usually alias to tinyint(1)
            if (h.rawType === 'tinyint(1)') subtype = 'checkbox';
            // numerical
            else if (h.isNumber) subtype = 'number';
            // Dates and timestamps
            else if (h.type === 'date') subtype = 'date';
            else if (h.type === 'timestamp') subtype = 'datetime-local';

            const validation: ValidatorFn[] = [];
            if (!h.nullable) validation.push(Validators.required);

            let fetchAutocompleteValues: () => Promise<any[]>;

            const constraint = _.find(meta.constraints, (c) => c.localColumn === h.name);
            if (constraint && constraint.type === 'foreign') {
                fetchAutocompleteValues = () =>
                    this.backend.columnValues(constraint.foreignTable, constraint.foreignColumn);
            }

            return {
                name: h.name,
                label: h.name,
                type,
                subtype,
                options: h.enumValues,
                validation,
                // hint: h.comment
                fetchAutocompleteValues
            };
        });
        // Add the submit button
        config.push({
            type: 'submit',
            label: 'SUBMIT',
            name: 'submit',
            // Set initially disabled, will become enabled again once the
            // form is valid
            disabled: true
        });

        return config;
    }
}