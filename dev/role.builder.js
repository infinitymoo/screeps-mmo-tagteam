var taskCommon = require('task.common');
var u = require('util.common');

var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
                creep.memory.building = false;
                creep.say('🔄');
            }
            if((!creep.memory.building && creep.store[RESOURCE_ENERGY] != 0) && (!creep.memory.hasHarvested || creep.memory.hasHarvested == 0 || creep.store.getFreeCapacity() == 0)) {
                creep.memory.building = true;
                creep.say('🚧');
            }
    
            if(creep.memory.building) {
                
                let targetRoom = creep.memory.targetRoom;
                let targetLock = creep.memory.targetLock;
                let target = Game.getObjectById(targetLock);

                //clear target if its not in the room we need to be in just in case we get assigned a target outside of our target area
                if(target && target.room.name != targetRoom) {
                    delete creep.memory.targetLock;
                    target = false;
                }

                if(!targetRoom) {
                    //if we can see target, it means we can set targetRoom from it
                    if( target ) {
                        targetRoom = target.room.name;
                        creep.memory.targetRoom = targetRoom;
                    }
                }
                        
                if(target && targetRoom && (creep.room.name == targetRoom)) {
                    var result = creep.build(target);

                    try {

                        if(result == ERR_NOT_IN_RANGE) {
                            creep.travelTo(
                                new RoomPosition(
                                    target.pos.x,
                                    target.pos.y,
                                    targetRoom),
                                { ignoreCreeps:false,
                                range:3,
                                reusePath:10});
                        }
                    }
                    catch(problem) {
                        console.log(`Exception builder: ${problem.name}: ${problem.message} ${problem.stack}  `);
                    }
                    
                    //this check prevents getting stuck on room borders if not moving off them with early return
                    if(target && target.room.name == creep.room.name)
                        return;
                }
                else if(targetRoom && (creep.room.name != targetRoom)) {
                    var destRoom = new RoomPosition(25,25,targetRoom);
                    creep.travelTo(destRoom, {ignoreCreeps:false,swampCost:1,range:10,maxRooms:4});

                    return;
                }
                //no targets set and we're in same room as we think we should be, so look for sites to build
                else {
                
                    if(!target) {
                        var buildSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                    
                        if(buildSite) {
                            targetLock = buildSite.id;
                            target = Game.getObjectById(targetLock);
                            
                            creep.memory.targetLock = targetLock;
                            creep.memory.targetRoom = target.room.name;
                        }
                    }
                    /*
                    var buildSites = Game.rooms[creep.room.name].find(FIND_CONSTRUCTION_SITES);
                    if(buildSites.length > 0) {
                        target = buildSites[0];
                        creep.memory.target = target;
                    }
                    */
                }
                
                //defaulting behaviour
                if(!target) {

                    this.doRepair(creep);
                }
                
            }
            else { //TODO roadworkers sometimes get stuck on room edges sometimes no idea how/why, must still debug that.

                var source = taskCommon.getClosestAvailableEnergy(creep);
                var collectionMethod;

                if(source instanceof Structure)
                    collectionMethod = "structure";
                else
                    collectionMethod = "source";
                
                if(source) {                        
                    var result;
                    if(collectionMethod == "structure")
                        result = creep.withdraw(source,RESOURCE_ENERGY);
                    else
                        result = creep.pickup(source);
                    
                    if(result == ERR_NOT_IN_RANGE) {
                        creep.travelTo(source,{ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
                    }
                    return;
                }
                else {
                    source = creep.pos.findClosestByRange(FIND_SOURCES);
                    var harvestResult = creep.harvest(source);
                    if( harvestResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(source, {ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
                    }
                    if( harvestResult == OK ) { // TODO calc harvest count to fill dont hardcode
                        if(creep.memory.hasHarvested && creep.memory.hasHarvested > 0) {
                            creep.memory.hasHarvested--;
                        }
                        else {
                            let capacity = creep.store.getFreeCapacity();
                            let workParts = _.filter(creep.body, function(b) {return b.type == WORK});
                            let harvestRate = workParts.length*2;
                            creep.memory.hasHarvested = capacity/(harvestRate*2);
                        }
                    }
                }
            }
        }
        catch (problem) {
            console.log(`Exception builder: ${problem.name}: ${problem.message} ${problem.stack}  `);
        }
    },

    //TODO needs optimization badly
    /** @param {Creep} creep **/
    doRepair: function(creep) {
        var result;
        let target = Game.getObjectById(creep.memory.target);

        if(target && target.structureType == STRUCTURE_RAMPART && target.hits < 300000) {
            if(creep.pos.isNearTo(target)) {
                result = creep.repair(target);
                //this check prevents getting stuck on room borders if not moving off them with early return
                if(target && target.room.name == creep.room.name)
                    if(result == OK)
                        return;
                if(result == ERR_NOT_IN_RANGE)
                    creep.travelTo(targets[0], {ignoreCreeps: false,range:3,maxRooms:1});
            }
        }

        //if anything like roads or walls repairable in range on way to walking to target, repair it
        var targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.hits < structure.hitsMax) && 
                structure.structureType == STRUCTURE_RAMPART &&
                    structure.hits < 300000;
            }});

        if(targets.length > 0) {
            if(creep.pos.isNearTo(targets[0])) {
                result = creep.repair(targets[0]);
                //this check prevents getting stuck on room borders if not moving off them with early return
                if(target && target.room.name == creep.room.name)
                    if(result == OK)
                        return;
            }
        }
        
        if(targets.length > 0 && (!target || target.hits == target.hitsMax || target.hits > 300000)) {
            creep.memory.target = targets[0].id;
            target = Game.getObjectById(creep.memory.target);
        }

        if(target && ( target.hits >= 300000 || target.hits == target.hitsMax )) {
            target = false;
            delete creep.memory.target;
        }
            
        if(target) {            
            result = creep.repair(target);
            if(result == ERR_NOT_IN_RANGE) {
                creep.travelTo(target, {ignoreCreeps: false,range:3,maxRooms:1});
                return;
            }
            //this check prevents getting stuck on room borders if not moving off them with early return
            if(target && target.room.name == creep.room.name)
                if(result == OK)
                    return; //early return if i could do this, toa void running below code
        }
        
        targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.hits < structure.hitsMax) && 
                    structure.hits < 300000;
            }});

        //do same as above for any non-rampart structures
        if(targets.length > 0) {
            if(creep.pos.isNearTo(targets[0])) {
                result = creep.repair(targets[0]);
                //this check prevents getting stuck on room borders if not moving off them with early return
                if(target && target.room.name == creep.room.name)
                    if(result == OK)
                        return;
            }
        }

        // u.debug(target,`builder debug 1`);
        // u.debug(targets.length,`builder debug 1.1`);
        // u.debug(!target,`builder debug 1.2`);
        // u.debug((target.hits == target.hitsMax),`builder debug 1.3`);
        // u.debug(target.hits,`builder debug 1.4`);
            
        if(targets.length > 0 && (!target || target.hits == target.hitsMax || target.hits > 300000)) {
            // u.debug(targets,`builder debug 2.1`)
            creep.memory.target = targets[0].id;
            target = Game.getObjectById(creep.memory.target);
        }
            
        if(target) {
            result = creep.repair(target);
            if(result == ERR_NOT_IN_RANGE) {
                creep.travelTo(target, {ignoreCreeps: false,range:3,maxRooms:1});
                return;
            }
            //this check prevents getting stuck on room borders if not moving off them with early return
            if(target && target.room.name == creep.room.name)
                if(result == OK)
                    return; //early return if i could do this, toa void running below code
        }
        
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.travelTo(creep.room.controller, {ignoreCreeps: false,range:1,maxRooms:1});
        }

    }
};

module.exports = roleBuilder;