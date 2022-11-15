var roleHarvester = require('role.harvester');
var baseCommon = require('base.common');
var u = require('util.common');

/** Limitations
 * 1 - creep.memory.target isn't automatically set
 * 2 - creep doesn't wait until full when waiting for harvester drops before returning to drop off
 * 3 - TODO How to keep transport coverage updated e.g. if i get bigger transfers with spawning of new transport creep etc.
 */

/** Summarized Behaviour
 *
 * */ 

var roleTransport = {

    /** @param {Creep} creep **/
    run: function(creep) {

        this.checkTransition(creep);

        //drop off
        if(creep.memory.working) {
            let result = -1000;
            let dropoffTarget = Game.getObjectById(creep.memory.dropoffTarget);


            //for now set storage as dropoff var target (not memory target)
            if( !dropoffTarget || dropoffTarget.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
                if( Game.rooms[creep.memory.homeRoom].storage ) {
                    creep.memory.dropoffTarget = Game.rooms[creep.memory.homeRoom].storage.id;
                    dropoffTarget = Game.getObjectById(creep.memory.dropoffTarget);
                }
                else {
                    
                    //TODO - must read this off cache instead of keeping to refresh it for every transport.
                    var targets = Game.rooms[creep.memory.homeRoom].find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (
                                structure.structureType == STRUCTURE_CONTAINER ||
                                structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN) &&
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                        }
                    });
                        
                    // if(targets.length > 1) {
                    //     for(var i=1;i<targets.length;i++) {
                    //         if(creep.pos.isNearTo(targets[i])) {
                    //             for(const resourceType in creep.store) {
                    //                 result = creep.transfer(targets[i], resourceType);
                    //                 // u.debug(resourceType,`stateEmptyStore in drop logic`);
                    //                 if( result == OK )
                    //                     break;
                    //             }
                    //         }
                    //     }
                    // }

                    if( targets && targets.length > 0 ) {
                        creep.memory.dropoffTarget = targets[0].id;
                        dropoffTarget = Game.getObjectById(creep.memory.dropoffTarget);
                    }
                }
            }
            
            if(dropoffTarget && dropoffTarget.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if(!creep.pos.isNearTo(dropoffTarget) ) {
                    creep.Move(dropoffTarget, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
                    return;
                }
                else {
                    for(const resourceType in creep.store) {
                        result = creep.transfer(dropoffTarget, resourceType); //TODO have to transfer all things not just energy
                        // u.debug(resourceType,`stateEmptyStore in drop logic`);
                        if( result == OK )
                            break;
                    }
                    
                    if( result != OK ) {
                        console.log(`WARNING: transport creep ${creep.name} couldn't transfer to target while next to it`);
                    }
                    else {
                        if( !Game.rooms[creep.memory.homeRoom].storage ) {
                            delete creep.memory.dropoffTarget;
                        }
                        this.checkTransition(creep);
                        //if transition successful
                        if( creep.memory.working == false )
                            creep.Move(Game.getObjectById(creep.memory.target), {ignoreCreeps: true,range:1,priority:2,allowSK:true});// not same as target around here, but is actual pickup target
                        return;
                    }
                }
                
            }; 

            //if we get here, it means none of the early returns happened and we can't drop off energy in structures, so go to controller to feed upgraders.
            
            if( !Game.rooms[creep.memory.homeRoom].storage ) {

                creep.Move(Game.rooms[creep.memory.homeRoom].controller,{ignoreCreeps: true,range:4,priority:2,allowSK:true}); // this bugs out to other rooms for some reason if i check its own room. why though?
                if(creep.room.name == creep.memory.homeRoom) {
                    var range = creep.pos.getRangeTo(creep.room.controller.pos);
                    if(range == 4)
                        creep.drop(RESOURCE_ENERGY);
                }
            }
            
        }
        //pickup
        else {
            var target = Game.getObjectById(creep.memory.target);

            //if we can't get a valid target from memory, it means we have to re-assign a new one.
            try {
                if(!target && (creep.store.getFreeCapacity() < (creep.store.getCapacity()/4))) {
                    creep.memory.working = true;
                }

                if(!target) {
                    delete creep.memory.target; //cleanup dead or non-existing target id reference;
                    var candidateTargets = [];
                    for( var i in Game.creeps ) {
                        if( Game.creeps[i].memory.role == "harvester" && Game.creeps[i].memory.homeRoom == creep.memory.homeRoom) {
                            let transportCoverageRetrieved = roleHarvester.getTransportCoverage(Game.creeps[i]);
                            if( (transportCoverageRetrieved > -1) && (transportCoverageRetrieved < 1) && !Game.creeps[i].spawning ) {
                                candidateTargets.push(Game.creeps[i].id);
                            }
                        }
                    }
                    
                    //console.log("transport candidates: "+JSON.stringify(candidateTargets));

                    if(candidateTargets[0]) {
                        //calculate transportcoverage and update the target harvester's coverage
                        let harvesterCreep = Game.getObjectById(candidateTargets[0]);
                        //console.log("transport candidates harvesterCreep: "+JSON.stringify(harvesterCreep));
                        let baseRange = roleHarvester.getBaseRange(harvesterCreep);
                        //console.log("transport candidates baseRange: "+JSON.stringify(baseRange));
                        if(baseRange > 0) {
                            let transportCoverage = this.calcTransportCoverage(creep,harvesterCreep,baseRange);
                            //console.log("transport candidates transportCoverage: "+JSON.stringify(transportCoverage));

                            //console.log(`transport ${creep.id} returned calcTransportCoverage of ${transportCoverage} for ${baseRange}`);

                            roleHarvester.setTransportCoverage(harvesterCreep,creep.id,transportCoverage);

                            //console.log(`transport ${creep.id} setting target ${candidateTargets[0].id}`)

                            creep.memory.target = harvesterCreep.id;
                            target = Game.getObjectById(creep.memory.target);
                        }
                    }
                }
            }
            catch(problem) {
                console.log("Excpetion in role.transport getting candidateTargets: "+ problem.name + ": " + problem.message + " " + problem.stack);
            }
            
            if(target) {
                var result;
                //this code starts to look for energy dropped by typically harvesters to pick it up, but swamps screws with 2 range because its slow to travel on them so parm is 4 range.
                if(creep.pos.isNearTo(target)) { //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                    //TODO this bugs out if energy is next to creep behind it because it won't pick up harvester drops then. Try get resource on harvester's position instead.
                    var source = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                    if( source && creep.pos.isNearTo(source) && target.pos.isNearTo(source) ) {
                        result = creep.pickup(source);
                        if( result == ERR_NOT_IN_RANGE) {
                            creep.Move(source, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
                            return;
                        }
                        if( result == OK ) {
                            this.checkTransition(creep);
                            return;
                        }
                    }
                    //if nothing on ground near target, withdraw from creep or tombstone (or ruin?) directly 
                    //TODO withdraw any resource not just energy
                    else {
                        let target = Game.getObjectById(creep.memory.target);
                        if( !target ) {
                            delete creep.memory.target;
                            return;
                        }

                        //testing this to see if bug still occuring
                        result = creep.pickup(target);
                        if(result == OK && (creep.store.getFreeCapacity() < (creep.store.getCapacity()/4))) {
                            creep.memory.working = true;
                            let dropoffTarget = Game.getObjectById(creep.memory.dropoffTarget);
                            if( dropoffTarget )
                                creep.Move(dropoffTarget, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
                        }

                        if( result == ERR_INVALID_TARGET) {
                            for(const resourceType in target.store) {
                                result = creep.withdraw(target,resourceType);
                                // u.debug(resourceType,`stateEmptyStore in drop logic`);
                                if( result == OK )
                                    break;
                            }
                        }

                        if( result == ERR_INVALID_TARGET) {
                            if( !target.owner.username == "Malkaar" ) // don't want to withdraw every tick from harvester, only transfer when harvester full, and that gets triggered from harvester
                                for(const resourceType in creep.store) {
                                    result = target.transfer(creep,resourceType);
                                    // u.debug(resourceType,`stateEmptyStore in drop logic`);
                                    if( result == OK )
                                        break;
                                }
                        }
                        if( result == ERR_NOT_IN_RANGE) {
                            creep.Move(target, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
                            return;
                        }
                        if( result == OK ) {
                            return;
                        }
                        //this is common when a harvester is moving on its way to target and transport is next to it
                        //throw new Error(`E role.transport next to target but couldn't do anything`);
                    }
                }
                else {

                    let nearbyResources = this.lookForNearbyResources(creep);
                    if( nearbyResources.length > 0 ) {
                        this.pickupNearbyResources( creep, nearbyResources );
                    }
                    

                    result = creep.Move(target, {ignoreCreeps: true,range:1,priority:2,allowSK:true}); //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                    //console.log(`transport ${creep.name} is trying to move to remote room ${}`);
                    return;
                }
                //if not within 4 range of source nor within range of dropped resources, move closer to target to get ready for pickup when it does drop resources
                // if( !targetIsDry ) {
                //     result = creep.Move(target, {ignoreCreeps: false,range:1,maxRooms:1}); //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                //     return;
                // }
                
            }
            
            //if no valid target could be found, look to make dropped source pile a target
            if(!target) {
            
                var sources = creep.room.find(FIND_DROPPED_RESOURCES);
                
                if(sources) {              
                    var source;      
                    if(sources.length > 1) {
                        var biggestPile = 0;
                        for(var i = 1; i < sources.length; i++) {
                            if (sources[i].amount > sources[biggestPile].amount) {
                                biggestPile = i;
                            }
                        }
                        source = sources[biggestPile];
                        creep.memory.target = source.id;
                    }
                    else if(sources[0]) {
                        source = sources[0];
                        creep.memory.target = sources[0].id;
                    }
                    //we're in 
                }
            }

            if(!target) {
                creep.Move(Game.rooms[creep.memory.homeRoom].controller, {ignoreCreeps: true,range:1,priority:2,allowSK:true});
            }
        }
    },

    /**
     * 
     * @param {Creep} creep 
     * @returns 
     */
    lookForNearbyResources: function(creep) {

        let nearbyResources = [];

        if( Game.time % 3 === 0) {

            for(let a = -1; a < 2; a++ ) {
                for( let b = -1; b < 2; b++) {

                    let lookX = Math.min( Math.max(creep.pos.x + a,0), 49 );
                    let lookY = Math.min( Math.max(creep.pos.y + b,0), 49 );
                    let lookPos = new RoomPosition(
                        lookX,
                        lookY,
                        creep.room.name);

                    let foundResources = lookPos.lookFor(LOOK_RESOURCES);

                    nearbyResources = nearbyResources.concat( foundResources );
                }
            }
        }

        return nearbyResources;
    },

    pickupNearbyResources: function( creep, nearbyResources ) {

        _.forEach( nearbyResources, (resource) => {

            if( creep.store.getFreeCapacity() == 0 )
                return false; //breaks forEach

            let result = creep.pickup( resource );

            if( result == OK && (creep.store.getFreeCapacity() < (creep.store.getCapacity()/4)) )
                creep.memory.working = true;
            
        } ) ;        

    },

    /**
     * Evaluates state of creep and determines if it should switch modes
     * @param {Creep} creep 
     */
    checkTransition: function(creep) {        
        // if empty, switch to sourcing mode
        if(creep.memory.working && creep.store.getUsedCapacity() == 0) {
            creep.memory.working = false;
            creep.say('🧊');
        }
        // if is full, go work
        else if(!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            //TODO check if target alive and if so wait to fill up before going back to give chance to share nearby pickup workload with other harvesters
            creep.memory.working = true;
            creep.say('🍺'); 
        }
    },

    sustainTarget: function(transportCreep) {

        /*SELECT TARGET*/

        /*CACHE TARGET*/

        //recover target

        //validate target

    },

    /**
     * Uses baseCommon room caches to pickup nearby stuff
     * TODO other stuff than energy
     * @param {Creep} transportCreep 
     */
    smartPickup: function(transportCreep) {
        
    },

    // This calculates coverage as a percentile (e.g. return value of 1 = 100%, 0.5 = 50%) based on work parts, range from base and transport capacity
    //TODO need to be cognisant of road-coverage and transport type (plain vs roadster) to calculate this properly
    /** @param {Creep} transportCreep **/
    /** @param {Creep} harvesterCreep **/
    /** @param {number} baseRange **/
    calcTransportCoverage: function(transportCreep,harvesterCreep,baseRange) {
        //calculate capacity based on max harvester utilization of unboosted normal energy node TODO - later to calc for midblock sources and boosted sources
        //let basicSourceMaxRate = 10;

        //console.log(`Info: role.transport calcTransportCoverage transportCreep: ${transportCreep.id}`);

        //count work modules on harvester
        let harvesterParts = _.filter(harvesterCreep.body, function(b) {return b.type == WORK});
        let transportRequirementPerTick = harvesterParts.length*2;
        if( harvesterCreep.memory.mode == "mineral" )
            transportRequirementPerTick = 5;

        //assume one step per tick and count both to and from travel. baseRange-2 because source+base positions don't count for distance,
        //transportRequirement is the amount of energy available for transport in the time a transport would take to go to base and come back
        let transportCapacityRequirement =  transportRequirementPerTick * (baseRange * 2); //unused right now

        //console.log(`Info: role.transport calcTransportCoverage transportCapacityRequirement: ${transportCapacityRequirement}`);

        let transportParts = _.filter(transportCreep.body, function(b) {return b.type == CARRY});

        let transportCapacity = (transportParts.length * CARRY_CAPACITY); //CARRY_CAPACITY is typically 50 per CARRY
        
        //console.log(`Info: role.transport calcTransportCoverage transportCapacity: ${transportCapacity}`);

        //transport rate must be compared with the source rate to measure efficiency (compare apples with apples)
        let transportRatePerTick = transportCapacity / (baseRange*2);
        
        //console.log(`Info: role.transport calcTransportCoverage transportRate: ${transportRatePerTick}`);

        //this strange calculation happens this way so that we can compare how much of the baseRange is covered with this transport's efficiency to easily see
        //in other code whether a harvester's transport requirements are filled or lacking
        let transportCoverage = transportRatePerTick / transportRequirementPerTick;
        
        //console.log(`Info: role.transport calcTransportCoverage transportCoverage: ${transportCoverage}`);

        return transportCoverage;
    }
};

module.exports = roleTransport;