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
                creep.Move(
                    new RoomPosition(
                        25,
                        25,
                        creep.memory.targetRoom),
                    { range:10,
                    reusePath:10});
                return;
            }
            
            if(creep.memory.mode && creep.memory.mode == "borders") {

                this.buildBorders( creep );
            }
            else {

                this.doRepair( creep );
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
                    creep.MoveOffRoad(source,{ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
                }
                return;
            }
            else {
                source = creep.pos.findClosestByRange(FIND_SOURCES);
                var harvestResult = creep.harvest(source);
                if( harvestResult == ERR_NOT_IN_RANGE) {
                    creep.MoveOffRoad(source, {ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
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
                creep.Move(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
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
            creep.MoveOffRoad(targetLock, {ignoreCreeps: false,range:3,maxRooms:1});
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
    },

    doRepair: function(creep) {

        //Validate
        let repairTarget = Game.getObjectById( creep.memory.repairTarget );
        
        if( !creep.memory.targetRoom ) {
            creep.memory.targetRoom = creep.memory.homeRoom;
        }

        if( repairTarget && repairTarget.room.name != creep.memory.targetRoom ) {
            delete creep.memory.repairTarget;
        }

        if( !repairTarget && creep.memory.targetRoom == creep.room.name ) {

            let nextTargetId = this.getRoomRepairTarget( creep, creep.room.name, creep.memory.repairTarget );
            let repairTarget = Game.getObjectById( nextTargetId );
            if( repairTarget ) {
                
                creep.memory.repairTarget = nextTargetId;
            }
        }

        // Execute
        let repairDone = false;
        if( repairTarget ) {

            if( (repairTarget.structureType == STRUCTURE_RAMPART || repairTarget.structureType == STRUCTURE_WALL) ) {

                let targetLevel = this.calcBorderTargetLevels( repairTarget.hits );
                if( repairTarget.hits < targetLevel ) {

                    this.continueRepair( creep, repairTarget );
                    return;
                }
                else {

                    repairDone = true;
                }
            }
            else if( repairTarget.structureType == STRUCTURE_ROAD || repairTarget.structureType == STRUCTURE_CONTAINER ) {

                let lastTarget = Game.getObjectById( creep.memory.repairTarget );

                if( lastTarget.hits < lastTarget.hitsMax ) {

                    this.continueRepair( creep, repairTarget );
                    return;
                }
                else {

                    repairDone = true;
                }
            }
        }

        if( repairDone ) {
            let nextTargetId = this.getRoomRepairTarget( creep, creep.room.name, creep.memory.repairTarget );
            let repairTarget = Game.getObjectById( nextTargetId );
            if( repairTarget ) {
                
                creep.memory.repairTarget = nextTargetId;
            }
        }


        if( !repairTarget && creep.room.controller && creep.room.controller.owner && creep.room.controller.my ) {

            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {

                creep.Move(creep.room.controller, {ignoreCreeps: false,range:3,maxRooms:1});
            }
        }

    },

    continueRepair( creep, target ) {

        let result;
        if( creep.pos.inRangeTo( target.pos, 3 )) {

            result = creep.repair(target);
            
            if(result == OK)
                return;                        
        }
        else {
            
            creep.Move(target, {ignoreCreeps: false,range:3,maxRooms:1});
            return;
        }
    },

    getRoomRepairTarget( creep, roomName, lastRepairTarget ) {

        if( !Memory.repairLookup ) Memory.repairLookup = {};

        if( !Memory.repairLookup[ roomName ] ) {

            Memory.repairLookup[ roomName ] = {};
            if( !Memory.rooms[ roomName ] )
                Memory.rooms[ roomName ] = {};
        }

        if( !Memory.rooms[ roomName ].repairUpdated ) {
            Memory.rooms[ roomName ].repairUpdated = Game.time;
            this.initRoomRepairTargets( creep, roomName );
        }

        if( Memory.rooms[ roomName ].repairUpdated >= Game.time + 1500 ) {

            Memory.rooms[ roomName ].repairUpdated = Game.time;
            this.initRoomRepairTargets( creep, roomName );
        }

        let repairTarget;
        let lastRepairTargetIndex = Memory.repairLookup[ roomName ].length;

        if( _.isUndefined( lastRepairTarget ) ) {

            for( let i = 0; i < Memory.repairLookup[ roomName ].length; i ++ ) {

                let repairCandidate = Game.getObjectById( Memory.repairLookup[ roomName ][i] );
                if( repairCandidate && repairCandidate.hits < repairCandidate.hitsMax ) {
                    repairTarget = repairCandidate.id;
                    break;
                }
            }
        }

        for( let i = 0; i < Memory.repairLookup[ roomName ].length; i ++ ) {

            if( Memory.repairLookup[ roomName ][i] == lastRepairTarget ) {
                lastRepairTargetIndex = i;
                if( lastRepairTargetIndex >= Memory.repairLookup[ roomName ].length )
                    delete creep.memory.repairTarget;
            }

            if( i >= lastRepairTargetIndex ) {

                let repairCandidate = Game.getObjectById( Memory.repairLookup[ roomName ][i] );
                if( repairCandidate && repairCandidate.hits < repairCandidate.hitsMax ) {
                    repairTarget = repairCandidate.id;
                    break;
                }
            }
        };

        return repairTarget;
    },

    initRoomRepairTargets( creep, roomName ) {

        let isOwner = false;
        if( Game.rooms[ roomName ].controller.owner && Game.rooms[ roomName ].controller.my)
            isOwner = true;
            
        u.debug( roomName, `initRoomRepairTargets`);
        //finds are expensive, so do it once and then filter out into other variables how we want to use it.
        let repairTargets = creep.room.find( FIND_STRUCTURES, {

            filter: (structure) => {
                return structure.structureType == STRUCTURE_CONTAINER ||
                structure.structureType == STRUCTURE_ROAD ||
                ( (structure.structureType == STRUCTURE_RAMPART || structure.structureType == STRUCTURE_WALL) && isOwner );
        }});

        let borders = _.filter( repairTargets, (repairTarget) => {
            return repairTarget.structureType == STRUCTURE_RAMPART || repairTarget.structureType == STRUCTURE_WALL;
        });

        let roads = _.filter( repairTargets, (repairTarget) => {
            return repairTarget.structureType == STRUCTURE_ROAD;
        });


        let containers = _.filter( repairTargets, (repairTarget) => {
            return repairTarget.structureType == STRUCTURE_CONTAINER;
        });

        let sortedBorders = _.sortBy( borders, 'hits' );
        let sortedRoads = this.sortByRoomPosition( roads );
        let sortedContainers = _.sortBy( containers, 'hits' );
        
        let compiledTargets = [];

        _.forEach( sortedRoads, (sortedItem) => { compiledTargets.push( sortedItem.id ) });
        _.forEach( sortedContainers, (sortedItem) => { compiledTargets.push( sortedItem.id ) });
        _.forEach( sortedBorders, (sortedItem) => { compiledTargets.push( sortedItem.id ) });

        Memory.repairLookup[ roomName ] = compiledTargets;
    },

    //needs .pos attribute
    sortByRoomPosition( roomObjectsArray ) {
        roomObjectsArray.sort( function ( a, b ) {

            var n = a.pos.x - b.pos.x;
            if (n !== 0) {
                return n;
            }
        
            return a.pos.y - b.pos.y;
        });

        return roomObjectsArray;
    },

    calcBorderTargetLevels(currentLevel) {

        if( currentLevel < 200000)
            return 300000;

        if( currentLevel < 800000)
            return 1000000;

        if( currentLevel < 2500000)
            return 3000000;

        if( currentLevel < 5000000)
            return 7000000;
            
        if( currentLevel < 10000000)
            return 12000000;

        if( currentLevel < 18000000)
            return 20000000;

        if( currentLevel < 48000000)
            return 50000000;

        if( currentLevel < 98000000)
            return 100000000;
    }
};

module.exports = roleRepairer;