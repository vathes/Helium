import { Component, OnInit } from '@angular/core';
import { Response } from '@angular/http';
import { ActivatedRoute, Params } from '@angular/router';

import * as _ from 'lodash';
import * as moment from 'moment';

import { SqlRow, TableHeader, TableMeta } from '../common/responses';
import { TableService } from './table.service';

interface DataTableHeader {
    name: string;
    prop: string;
}

interface Page {
    number: number;
    size: number;
    data: SqlRow[];
}

@Component({
    selector: 'home',
    templateUrl: 'table.component.html'
})
export class TableComponent implements OnInit {
    /** Time in milliseconds before showing a loading bar on the table */
    private static readonly LOADING_DELAY = 200;
    public name: string;
    public meta: TableMeta = {
        headers: [],
        totalRows: 0
    };
    public tableHeaders: DataTableHeader[];
    public exists: boolean = false;

    /** If this component has had time to get itself together yet */
    public initialized: boolean = false;
    public limit: number = 2;
    public sort: string;
    public loading: boolean = false;

    public page: Page = {
        number: -1,
        size: 0,
        data: []
    };

    constructor(
        private backend: TableService,
        private route: ActivatedRoute
    ) {}

    public ngOnInit(): void {
        this.route.params.subscribe(async (params: Params) => {
            this.name = params.name;

            try {
                this.meta = await this.backend.meta(this.name);
                this.tableHeaders = this.createTableHeaders(this.meta.headers);
                this.exists = true;
                // Set the initial page now that we have some data
                this.setPage({ offset: 0 });
            } catch (e) {
                // Handle 404s, show the user that the table couldn't be found
                if (e instanceof Response && e.status === 404) {
                    this.exists = false;
                    return;
                }

                // Other error, rethrow it
                throw e;
            } finally {
                // Whether the table exists or not, let the view know that we're
                // done loading
                this.initialized = true;
            }
        });
    }

    private setPage(event: any) {
        return this.showLoading(async () => {
            // page 1 === offset 0, page 2 === offset 1, etc.
            const page = event.offset + 1;
            // Get the raw data from the service and format it
            const raw = await this.backend.content(this.name, page, this.limit, this.sort);
            const content = this.formatRows(this.meta.headers, raw);

            // Update the page
            this.page = {
                number: event.offset,
                size: content.length,
                data: content
            };
        });
    }

    private onSort(event: any) {
        const sortDirPrefix = event.sorts[0].dir === 'desc' ? '-' : '';
        // '-prop' for descending, 'prop' for ascending
        const sort = sortDirPrefix + event.sorts[0].prop;
        this.sort = sort;
        this.showLoading(async () => {
            const raw = await this.backend.content(this.name, 1, this.limit, this.sort);
            const data = this.formatRows(this.meta.headers, raw);
            this.page = {
                number: 0,
                size: data.length,
                data
            };
        });
    }

    /**
     * This function executes some function, waiting `LOADING_DELAY`
     * milliseconds before settings `this.loading` to true. `this.loading` is
     * set to false immediately after the Promise has resolved.
     */
    private showLoading(doWork: () => Promise<void>) {
        const timeout = setTimeout(() => {
            this.loading = true;
        }, TableComponent.LOADING_DELAY);

        doWork().then(() => {
            this.loading = false;
            clearTimeout(timeout);
        });
    }

    private createTableHeaders(headers: TableHeader[]): DataTableHeader[] {
        return _.sortBy(_.map(headers, (h) => ({ name: h.name, prop: h.name })), 'ordinalPosition');
    }

    private formatRows(headers: TableHeader[], rows: SqlRow[]): SqlRow[] {
        const copied = _.clone(rows);

        // Iterate through each row
        for (const row of copied) {
            // Iterate through each cell in that row
            for (const headerName of Object.keys(row)) {
                const header = _.find(headers, (h) => h.name === headerName);
                // Use moment to format dates
                if (header.type === 'date')
                    row[headerName] = moment(row[headerName]).format('l');
            }
        }

        return copied;
    }
}