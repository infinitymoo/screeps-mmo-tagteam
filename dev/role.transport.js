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
            
            ((creep.store[RESOURCE_ENERGY] != 0 && //was 
            (creep.room.name == creep.memory.homeRoom) ) ||
            
            (creep.store.getFreeCapacity() == 0 &&
            (creep.room.name != creep.memory.homeRoom)) )
            ) {
                    
            creep.memory.transport = true;
            creep.say('dropoff');
        }

        if(creep.memory.transport) {
            var targetRoom = creep.memory.targetRoom;
            if(targetRoom && creep.room.name != Memory.homeRoom) {
                creep.travelTo(new RoomPosition(30,25,Memory.homeRoom), {ignoreCreeps:true,range:5}); //check if this is main cuase of heavy cpu use
                return;
            }
                
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER ||
                        structure.structureType == STRUCTURE_LINK) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            //prioritize storage as destination
            if(creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
                let result = -1000;
                if(!creep.pos.isNearTo(creep.room.storage) ) {
                    creep.travelTo(creep.room.storage, {ignoreCreeps: false,range:1,maxRooms:1});
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
                    creep.travelTo(targets[0], {ignoreCreeps: false,range:1,maxRooms:1});
                    return;
                }
                
                result = creep.transfer(targets[0], RESOURCE_ENERGY);
                //console.log(result);
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targets[0], {ignoreCreeps: false,range:1,maxRooms:1});
                }
            }
            else {
                creep.travelTo(Game.rooms[Memory.homeRoom].controller,{range:4}); // this bugs out to other rooms for some reason if i check its own room. why though?
                var range = creep.pos.getRangeTo(creep.room.controller.pos);
                if(range == 4)
                    creep.drop(RESOURCE_ENERGY);
            }
        }
        else {
            var targetRoom = creep.memory.targetRoom;
            if(targetRoom) {
                if(creep.room.name != targetRoom) {
                    var target = Game.getObjectById(creep.memory.target);
                    if(target)
                        creep.travelTo(new RoomPosition(target.pos.x,target.pos.y,creep.memory.targetRoom), {range:2});
                    else {
                        creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom), {range:10});//TOD test if range 23 works to just get to edge so rest of local logic will work
                    }
                    return;
                }
            }
            
            //first determine if targetted hauling and execute if so, will focus on pickup around target only - also early return to avoid defaulting cleaning behaviour
            var target = Game.getObjectById(creep.memory.target);
           // var targetIsDry = false; // this diesn't check if dry just if doesn't have dropped resources to work from
            
            //check if target is dry
            // if( target ) {
            //     var source = target.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            //     if( source && !target.pos.inRangeTo(source,4)) {
            //         targetIsDry = true;
            //     }
            // }
            
            if(target) {
                var result;
                //this code starts to look for energy dropped by typically harvesters to pick it up, but swamps screws with 2 range because its slow to travel on them so parm is 4 range.
                if(creep.pos.inRangeTo(target,1)) { //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                    var source = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                    
                    if( source && creep.pos.inRangeTo(source,1) && target.pos.inRangeTo(source,4) ) {
                        result = creep.pickup(source);
                        if( result == ERR_NOT_IN_RANGE) {
                            creep.travelTo(source, {ignoreCreeps: false,range:1,maxRooms:1});
                            return;
                        }
                        if( result == OK ) {
                            return;
                        }
                    }
                    // else {
                    //     targetIsDry = true;
                    // }
                }
                else {
                    result = creep.travelTo(target, {ignoreCreeps: false,range:1,maxRooms:1}); //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                    return;
                }
                //if not within 4 range of source nor within range of dropped resources, move closer to target to get ready for pickup when it does drop resources
                // if( !targetIsDry ) {
                //     result = creep.travelTo(target, {ignoreCreeps: false,range:1,maxRooms:1}); //small swamps can screw up 2 range, so make it 4 before looking for dropped res
                //     return;
                // }
                
            }

            //if we get here, it means we don't have targetted hauling otherwise above code would have executed already. See if we can dynamically get a target assigned.
            if( !creep.memory.target ) {
                var candidateTargets = _.filter( Game.creeps,(harvesterCreep) => {
                    return harvesterCreep.memory.role == "harvester" &&
                    roleHarvester.getTransportCoverage(harvesterCreep) < roleHarvester.getBaseRange(harvesterCreep) &&
                    !harvesterCreep.spawning});

                if(candidateTargets[0]) {
                    //calculate transportcoverage and update the target harvester's coverage
                    let baseRange = roleHarvester.getBaseRange(candidateTargets[0]);
                    let transportCoverage = this.calcTransportCoverage(creep,candidateTargets[0],baseRange);
                    roleHarvester.setTransportCoverage(candidateTargets[0],transportCoverage);
                    creep.memory.target = candidateTargets[0].id;
                }
            }
            
            //if no targetted hauling, default to cleaning up dropped resources
            var source = Game.getObjectById(creep.memory.source);
            
            if(!source) {
                var sources = creep.room.find(FIND_DROPPED_RESOURCES);
                
                if(sources.length > 1) {
                    var biggestPile = 0;
                    for(var i = 1; i < sources.length; i++) {
                        if (sources[i].amount > sources[biggestPile].amount) {
                            biggestPile = i;
                        }
                    }
                    source = sources[biggestPile];
                    creep.memory.source = source.id;
                }
                else if(sources[0]) {
                    source = sources[0];
                    creep.memory.source = sources[0].id;
                }
            }
            else {
                source = Game.getObjectById(creep.memory.source);
            }
            
            if(source) {
                if(creep.pickup(source) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(source, {ignoreCreeps: false,range:1,maxRooms:1});
                }
            }
        }
    },
    
    //TODO need to be cognisant of road-coverage and transport type (plain vs roadster) to calculate this properly
    /** @param {Creep} transportCreep **/
    /** @param {Creep} harvesterCreep **/
    /** @param {number} baseRange **/
    calcTransportCoverage: function(transportCreep,harvesterCreep,baseRange) {
        //calculate capacity based on max harvester utilization of unboosted normal energy node TODO - later to calc for midblock sources and boosted sources
        //let basicSourceMaxRate = 10;

        console.log(`Info: role.transport calcTransportCoverage transportCreep: ${transportCreep.id}`);

        //count work modules on harvester
        let harvesterParts = _.filter(harvesterCreep.body, function(b) {return b.type == WORK});
        let basicSourceMaxRate = harvesterParts.length*2;

        //assume one step per tick and count both to and from travel. baseRange-2 because source+base positions don't count for distance,
        //transportRequirement is the amount of energy available for transport in the time a transport would take to go to base and come back
        let transportRequirement = baseRange * basicSourceMaxRate * 2; 

        console.log(`Info: role.transport calcTransportCoverage transportRequirement: ${transportRequirement}`);
        
        console.log(`Info: role.transport calcTransportCoverage transportCreep.body: ${JSON.stringify(transportCreep.body)}`);

        let transportParts = _.filter(transportCreep.body, function(b) {return b.type == CARRY});

        console.log(`Info: role.transport calcTransportCoverage transportParts length: ${transportParts.length}`);

        let transportCapacity = (transportParts.length * CARRY_CAPACITY); //CARRY_CAPACITY is typically 50 per CARRY
        
        console.log(`Info: role.transport calcTransportCoverage transportCapacity: ${transportCapacity}`);

        //transport rate must be compared with the source rate to measure efficiency (compare apples with apples)
        let transportRate = transportCapacity / (baseRange*basicSourceMaxRate*2);
        
        console.log(`Info: role.transport calcTransportCoverage transportRate: ${transportRate}`);

        //this strange calculation happens this way so that we can compare how much of the baseRange is covered with this transport's efficiency to easily see
        //in other code whether a harvester's transport requirements are filled or lacking
        let transportCoverage = transportRate * baseRange;
        
        console.log(`Info: role.transport calcTransportCoverage transportCoverage: ${transportCoverage}`);

        return transportCoverage;
    }
};

module.exports = roleTransport;