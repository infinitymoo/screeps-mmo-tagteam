var u = require('util.common');
var taskCommon = require('task.common');
const { __esModule } = require('./Traveler');

var roleRepairer = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.memory.repairing && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.repairing = false;
            creep.say('🔄 source');
        }
        if(!creep.memory.repairing && creep.store.getFreeCapacity() == 0) {
            creep.memory.repairing = true;
            creep.say('⚡ repair');
        }

        if(creep.memory.repairing) {

            //validate correct room
            if(!creep.memory.targetRoom) {
                creep.memory.targetRoom = creep.memory.homeRoom;
            }

            if(creep.memory.targetRoom && creep.room.name != creep.memory.targetRoom) {
                creep.travelTo(
                    new RoomPosition(
                        25,
                        25,
                        creep.memory.targetRoom),
                    { range:10,
                    reusePath:10});
                return;
            }
            
            //shortcut to special modes
            if(creep.memory.mode && creep.memory.mode == "borders")
                this.buildBorders(creep);
            else {
                //initialize for normal mode
                var result;
                let target = Game.getObjectById(creep.memory.target);
                
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.hits < structure.hitsMax) &&
                            structure.hits < 300000;
                    }});

                if(targets.length > 0 && (!target || target.hits == target.hitsMax || target.hits > 300000)) {
                    creep.memory.target = targets[0].id;
                    target = Game.getObjectById(creep.memory.target);
                }
        
                if(targets.length > 0) {
                    for(var i=0;i<targets.length;i++) {
                        if(creep.pos.isNearTo(targets[i])) {
                            result = creep.repair(targets[i]);
                            //this check prevents getting stuck on room borders if not moving off them with early return
                            if(target && target.room.name == creep.memory.targetRoom)
                                if(result == OK)
                                    return;
                        }
                    }
                }
                    
                if(target) {
                    result = creep.repair(target);
                    if(result == ERR_NOT_IN_RANGE) {
                        creep.travelTo(target, {ignoreCreeps: false,range:3,maxRooms:1});
                        return;
                    }
                    if(result == OK)
                        return; //early return if i could do this, toa void running below code
                }
                
                targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.hits < ( structure.hitsMax - 2000 )) && // the -1000 modifier is to allow things like walls etc to be built up when roads etc are in relatively good condition
                            (structure.structureType == STRUCTURE_ROAD ||
                            structure.structureType == STRUCTURE_CONTAINER);
                    }});
        
                if(targets.length > 0 && (!target || target.hits == target.hitsMax)) {
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
                
                targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.hits < ( structure.hitsMax - 2000 )) &&
                            (structure.structureType == STRUCTURE_RAMPART ||
                            structure.structureType == STRUCTURE_WALL) &&
                            structure.hits < 2000000;
                    }});
        
                if(targets.length > 0 && (!target || target.hits == target.hitsMax || target.hits > 2000000)) {
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
        }
        else {

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
                    else
                        creep.memory.hasHarvested = 12;// assuming 2 work parts TODO make dynamic
                }
            }
            
            //default way, now replacing with dropped resource method
            /*
            var sources = creep.room.find(FIND_SOURCES);
            if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                creep.travelTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            */
        }
    },

    buildBorders(creep) {
        //initialization
        let targetHitCount = this.calcBorderTargetLevels(creep);
        let targetLock = Game.getObjectById(creep.memory.target);

        //u.debug(targetLock,`buildBorders 1`);

        //validation
        if( !targetLock || (targetLock && targetLock.structureType != STRUCTURE_RAMPART && targetLock.structureType != STRUCTURE_WALL)) {
            //u.debug(targetLock.structureType,`buildBorders 2`);
            delete creep.memory.target;
            targetLock = false;
        }
        if(!targetLock || (targetLock && targetLock.hits >= targetHitCount)) {
        
            let borderStructures = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.hits < structure.hitsMax) &&
                        (structure.structureType == STRUCTURE_RAMPART ||
                        structure.structureType == STRUCTURE_WALL)
                }});

            let structuresToRepair = this.getBorderStructuresByHitCount(borderStructures,targetHitCount);
            if( structuresToRepair.length > 0 ) {                
                targetLock = structuresToRepair[0];
                creep.memory.target = targetLock.id;
            }
            //u.debug(structuresToRepair,`buildBorders 3`);
        }

        //execution
        let result = creep.repair(targetLock);
       // u.debug(result,`buildBorders 4`);
        if(result == ERR_NOT_IN_RANGE) {
            creep.travelTo(targetLock, {ignoreCreeps: false,range:3,maxRooms:1});
            return;
        }

    },

    calcBorderTargetLevels(creep) {
        switch(creep.room.controller.level) {
            case 2: return 300000;
            case 3: return 1000000;
            case 4: return 3000000;
            case 5: 
            case 6:
            case 7: return 5000000;
            case 8: return 10000000; //hardcap my stuff for now
            default: return 0;
        }
    },

    getBorderStructuresByHitCount(cachedTargets, hitCount) {
        //initialization
        let targets = cachedTargets;

        //validation
        if(!hitCount)
            throw new Error(`getBorderStructuresByLevel needs hitCount, got ${hitCount}`);
        if(!targets)
            targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.hits < structure.hitsMax) &&
                        (structure.structureType == STRUCTURE_RAMPART ||
                        structure.structureType == STRUCTURE_WALL) /*&&
                        structure.hits < hitCount;*/
                }});
        
        //execution
        let borderStructures = _.filter( targets, (t) => {
            return t.hits < hitCount
        });

        return borderStructures;
    }
};

module.exports = roleRepairer;