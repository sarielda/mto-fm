/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, OnInit, OnDestroy, Input, Output, OnChanges, SimpleChange } from '@angular/core';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { Counts } from './counts';
import { NumberOfCarsService } from './number-of-cars.service';


@Component({
  moduleId: module.id,
  selector: 'fmdash-number-of-cars',
  templateUrl: 'number-of-cars.component.html',
  styles: [`
  .carStatsColumn a {
    display: block;
    width: 100%;
    height: 100%;
  }
  `],
  providers: [NumberOfCarsService],
})
export class NumberOfCarsComponent implements OnInit, OnDestroy, OnChanges {

  @Input() region: any;
  @Input() regions: any[];

  // For "region"
  public regionSubject = new Subject<any>();
  public regionCounts$: Observable<Counts[]>;

  // For "regions"
  public regionsSubject = new Subject<any[]>();
  public regionsCounts$: Observable<Counts[]>;


  constructor(private numberOfCarsService: NumberOfCarsService) { }

  ngOnInit() {
    // initialize Observable for single

    if(this.region){
       this.regionCounts$ = this.regionSubject
        .debounceTime(500)
        .distinctUntilChanged()
        .switchMap(region => this.numberOfCarsService.getNumberOfCars(region, 2))
        .catch(error => {
          console.log(error);
          return Observable.of(<Counts>{});
        })
        .map(v => [v]); // CAUTION: convert to an array so that we can use ngFor in template
    }

    // initialize Obserbable for multiple
    if(this.regions){
      // FIXME: not sure, but the following logic which track changes to "regions" does NOT work. Fix later
      // this.regionsCounts$ = this.regionsSubject
      //   // .debounceTime(500)
      //   // .distinctUntilChanged()
      //   .switchMap(regions => {
      //     let obss = regions.map(region => {
      //       return this.numberOfCarsService.getNumberOfCars(region, 15);
      //     });
      //     return Observable.combineLatest(obss, function(...values){
      //       return <Counts[]>values;
      //     });
      //   })
      //   .catch(error => {
      //     console.log(error);
      //     return Observable.of(<Counts[]>{});
      //   });
      var obss = this.regions.map(region => {
        return this.numberOfCarsService.getNumberOfCars(region, 2);
      });
      this.regionsCounts$ = Observable.combineLatest(obss, function(...values){
        return <Counts[]>values;
      });
    }
  }

  ngOnDestroy(){

  }

  ngOnChanges(changes: { [key: string]: SimpleChange} ) {
    // translates @Input(s) to observable subjects
    let newRegionChange = changes['region'];
    if(newRegionChange){
      this.regionSubject.next(newRegionChange.currentValue);
      console.log('The region @Input attribute is changed!');
    }
    let newRegionsChange = changes['regions'];
    if(newRegionsChange){
      this.regionsSubject.next(newRegionsChange.currentValue);
      this.regionsSubject.complete();
      console.log('The regions @Input attribute is changed!');
    }
  }
}
