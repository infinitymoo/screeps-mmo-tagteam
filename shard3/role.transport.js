var roleHarvester = require('role.harvester');

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

        if(creep.memory.transport &&
            creep.store[RESOURCE_ENERGY] == 0) {
                
            creep.memory.transport = false;
            creep.say('🔄 pickup');
        }
        else if(
            !creep.memory.transport &&
            //TODO check if target alive and if so wait to fill up before going back to give chance to share nearby pickup workload with other harvesters
            ((creep.store[RESOURCE_ENERGY] != 0 && //was 
            (creep.room.name == creep.memory.homeRoom) ) ||
            
            (creep.store.getFreeCapacity() == 0 &&
            (creep.room.name != creep.memory.homeRoom)) )
            ) {
                    
            creep.memory.transport = true;
            creep.say('dropoff');
        }

        //drop off
        if(creep.memory.transport) {
            /*
            var targetRoom = creep.memory.targetRoom;
            if(targetRoom && (creep.room.name != creep.memory.homeRoom)) {
                creep.travelTo(new RoomPosition(25,25,creep.memory.homeRoom), {ignoreCreeps:true,range:20}); //check if this is main cuase of heavy cpu use
                return;
            }
            */
                
            var targets = Game.rooms[creep.memory.homeRoom].find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER ||
                       // structure.structureType == STRUCTURE_CONTAINER ||
                        structure.structureType == STRUCTURE_LINK) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            //prioritize storage as destination
            if(creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
                let result = -1000;
                if(!creep.pos.isNearTo(creep.room.storage) ) {
                    creep.travelTo(creep.room.storage, {ignoreCreeps: false,range:1,maxRooms:3});
                }
                else {                            
                    result = creep.transfer(creep.room.storage, RESOURCE_ENERGY);
                    return;
                }
                
                if(targets.length > 1) {
                    for(var i=1;i<targets.length;i++) {
                        if(creep.pos.isNearTo(targets[i])) {
                            result = creep.transfer(targets[i], RESOURCE_ENERGY);
                            if(result == OK)
                                break;
                        }
                    }
                }
                return;
            }
            
            //console.log(JSON.stringify(targets));
                
            var targets = Game.rooms[creep.memory.homeRoom].find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER ||
                       // structure.structureType == STRUCTURE_CONTAINER ||
                        structure.structureType == STRUCTURE_LINK) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            if(targets[0]) {
                var result;
                if(targets.length > 1) {
                    for(var i=1;i<targets.length;i++) {
                        if(creep.pos.isNearTo(targets[i])) {
                            result = creep.transfer(targets[i], RESOURCE_ENERGY);
                            if(result == OK)
                                break;
                        }
                    }
                }
                
                if( result == OK && !creep.pos.isNearTo(targets[0]) ) {
                    creep.travelTo(targets[0], {ignoreCreeps: false,range:1,maxRooms:3});
                    return;
                }
                
                result = creep.transfer(targets[0], RESOURCE_ENERGY);
                //console.log(result);
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targets[0], {ignoreCreeps: false,range:1,maxRooms:3});
                }
            }
            else {
                creep.travelTo(Game.rooms[creep.memory.homeRoom].controller,{range:4}); // this bugs out to other rooms for some reason if i check its own room. why though?
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
                if(!target) {
                    delete creep.memory.target; //cleanup dead or non-existing target id reference;
                    var candidateTargets = [];
                    for( var i in Game.creeps ) {
                        if( Game.creeps[i].memory.role == "harvester" ) {
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
            catch(problem) {
                console.log("Excpetion in role.transport getting candidateTargets: "+ problem.name + ": " + problem.message + " " + problem.stack);
            }
            
            if(target) {
                var result;
                //this code starts to look for energy dropped by typically harvesters to pick it up, but swamps screws with 2 range because its slow to travel on them so parm is 4 range.
                if(creep.pos.inRangeTo(target,1)) { //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                    var source = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                    
                    if( source && creep.pos.inRangeTo(source,1) && target.pos.inRangeTo(source,1) ) {
                        result = creep.pickup(source);
                        if( result == ERR_NOT_IN_RANGE) {
                            creep.travelTo(source, {ignoreCreeps: false,range:1,maxRooms:3});
                            return;
                        }
                        if( result == OK ) {
                            return;
                        }
                    }
                    //if nothing on ground near target, withdraw from creep directly 
                    else if( Game.getObjectById(creep.memory.target) instanceof Creep || Game.getObjectById(creep.memory.target) instanceof Tombstone) {
                        result = creep.withdraw(Game.getObjectById(creep.memory.target),RESOURCE_ENERGY);
                        if( result == ERR_NOT_IN_RANGE) {
                            creep.travelTo(Game.getObjectById(creep.memory.target), {ignoreCreeps: false,range:1,maxRooms:3});
                            return;
                        }
                        if( result == OK ) {
                            return;
                        }
                        
                    }
                    //don't chase dropped resources, stay in milking position.
                    else {
                        //targetIsDry = true;
                        return;
                    }
                }
                else {
                    result = creep.travelTo(target/*, {ignoreCreeps: false,range:1,maxRooms:1}*/); //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                    //console.log(`transport ${creep.name} is trying to move to remote room ${}`);
                    return;
                }
                //if not within 4 range of source nor within range of dropped resources, move closer to target to get ready for pickup when it does drop resources
                // if( !targetIsDry ) {
                //     result = creep.travelTo(target, {ignoreCreeps: false,range:1,maxRooms:1}); //small swamps can screw up 2 range, so make it 4 before looking for dropped res
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
        }
    },

    sustainTarget: function(transportCreep) {

        /*SELECT TARGET*/

        /*CACHE TARGET*/

        //recover target

        //validate target

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