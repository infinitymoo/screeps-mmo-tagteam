var u = require('util.common');
var diplomacy = require('diplomacy');

var roleAttacker = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {

            switch(creep.memory.mode) {

                case "home":
                    creep.Move(Game.rooms[creep.memory.homeRoom].controller,{range:2,allowHostile:true,allowSK:true});
                    this.combatInRange( creep );
                    break;

                case "mission":
                    this.coordinateMission(creep);
                    break;

                default:
                    this.defaultMode(creep);
            }
        
        }
        catch (problem) {
            console.log(`Exception thrown role.attacker: ${problem.name}: ${problem.message} ${problem.stack}`);
        }
    },

    coordinateMission(creep) {

        //initialization / updates of mission leader and members
        if( !Memory.missions )
            Memory.missions = [];
        
        if( Memory.missions.length < 1 ) {
            Memory.missions.push({
                leader: false,
                members: []
            });
        }

        let missionParms = Memory.missions[0];
        if( !missionParms.leader ) {
            Memory.missions[0].leader = creep.id;
            missionParms.leader = Memory.missions[0].leader;
        }
        else if ( creep.id != missionParms.leader && !_.includes(Memory.missions[0].members,creep.id) ) {
            if( !Memory.missions[0].members ) {
                Memory.missions[0].members = [];
            }
            Memory.missions[0].members.push(creep.id);
        }

        //leader moves to flag and controls members move logic
        if( missionParms.leader == creep.id ) {

            if( this.onRoomEdge( creep ) ) {
                u.debug(creep.pos,`leader on edge`);
                delete creep.memory.currentFlag;
                this.moveToFlagMode(creep);                
            }

            if( this.membersInPosition(creep.id,Memory.missions[0].members)) {
                this.moveMembers(Memory.missions[0].members,creep.pos);
            }            
            if( ( creep.room.name == creep.memory.homeRoom && creep.memory.currentFlag && !creep.pos.isEqualTo(Game.flags[creep.memory.currentFlag].pos) ) || this.membersInPosition(creep.id,Memory.missions[0].members) ) {
                this.moveToFlagMode(creep);
            }
        }
        //if you arrived at leader's position, leader will move you, otherwise, you move to leader
        else {
            creep.moveTo(Game.getObjectById(missionParms.leader),{range:0,allowHostile:true,allowSK:true});
        }

        this.combatInRange(creep);

    },

    onRoomEdge( creep ) {

        if(  creep.pos.x == 0 ||
            creep.pos.x == 49 ||
            creep.pos.y == 0 ||
            creep.pos.y == 49 )
                return true;
        else
            return false;        

    },

    moveMembers: function(memberCreeps,leaderPos) {

        _.forEach( memberCreeps, (mcId) => {
            mc = Game.getObjectById(mcId);
            mc.moveTo(leaderPos,{ignoreCreep:true,range:0,allowHostile:true,allowSK:true});
        } );

    },

    membersInPosition: function(leaderId, memberCreeps) {
        
        for( let c in memberCreeps ) {
            let memberCreep = Game.getObjectById(memberCreeps[c]);
            if( !memberCreep )
                Memory.missions.members = [];

            if( !memberCreep.pos.isNearTo( Game.getObjectById(leaderId) ) )
                return false;
        }

        return true;
    },

    moveToFlagMode: function(creep) {

        let currentFlag = false;
        if( creep.memory.currentFlag )
            currentFlag = Game.flags[creep.memory.currentFlag];
        let travelResult = false;

        if(!currentFlag)
            currentFlag = this.findNextFlag(creep);

        if(currentFlag) {
            if( creep.room.name == currentFlag.pos.roomName ) {
                if( !creep.pos.isEqualTo(currentFlag.pos)) {
                    travelResult = creep.travelTo(currentFlag.pos,{ignoreCreep:true,allowHostile:true,allowSK:true});
                }
                else {
                    travelResult = creep.Move(new RoomPosition(25,25,creep.memory.targetRoom),{ignoreCreep:true,range:20,allowHostile:true,allowSK:true});
                }

            }
            else {
                travelResult = creep.Move(new RoomPosition(25,25,creep.memory.targetRoom),{ignoreCreep:true,range:20,allowHostile:true,allowSK:true});
            }
        }
        else {
            travelResult = creep.Move(new RoomPosition(25,25,creep.memory.targetRoom),{ignoreCreep:true,range:20,allowHostile:true,allowSK:true});
        }
        
    },

    findNextFlag: function (creep) {

        let roomFlags = _.filter( Game.flags, (f) => {
            return f.pos.roomName == creep.room.name;
        });

        // u.debug(roomFlags, `findNextFlag found roomFlags for ${creep.name}`)

        for( let f in roomFlags ) {
            // u.debug(f, `findNextFlag f`);
            // u.debug(roomFlags[f], `findNextFlag roomFlags[f]`);

            if( roomFlags[f].name == `${creep.room.name}-${creep.memory.targetRoom}` ) {
                creep.memory.currentFlag = roomFlags[f].name;
                return Game.flags[creep.memory.currentFlag];
            }
        }

        return false;

    },

    combatInRange: function( creep ) {

        let attackResult;
        let rangedAttackResult;

        // Target Acquisition
        let targetCreep;
        let targetStructure;
        let target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (hostileCreep) => {
                return !diplomacy.isAlly( hostileCreep.owner.username )
            }
        });
        targetCreep = target;
        if(targetCreep && targetCreep.hits !== 0 )
            creep.memory.target = targetCreep.id;            
        
        targetStructure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
            filter: (hostileStructure) => {
                return !diplomacy.isAlly( hostileStructure.owner.username )
            }});
        // if(targetStructure && targetStructure.structureType != STRUCTURE_CONTROLLER)
        //     creep.memory.target = target.id;
        

        // Weapon Callibration
        let hasAttackParts = _.filter( creep.body, (bodyPart) => {
            return bodyPart.type == ATTACK;
        });
        let hasRangedAttackParts = _.filter( creep.body, (bodyPart) => {
            return bodyPart.type == RANGED_ATTACK;
        });

        if( hasRangedAttackParts.length > 0 ) {
            rangedAttackResult = creep.rangedAttack(targetCreep);
            if( rangedAttackResult == ERR_NOT_IN_RANGE ) {
                rangedAttackResult = creep.attack(targetStructure);
            }
        }

        // if(rangedAttackResult == ERR_NOT_IN_RANGE) {
        //     if( this.safeToMoveTo(creep,targetCreep) )
        //         creep.Move(targetCreep,{allowHostile:true,allowSK:true});
        // }

        // Melee if no healing required yet
        let healTarget = this.resolveHealTarget(creep);
        if( !targetCreep && !targetStructure )
            creep.Move(healTarget);

        if( !healTarget ) {
            if( hasAttackParts.length > 0 ) {
                let targetLock = Game.getObjectById(creep.memory.target);

                if( targetLock )
                    attackResult = creep.attack( targetLock )
                else {
                    if( targetCreep )
                        attackResult = creep.attack( targetCreep );
                    if( attackResult == ERR_NOT_IN_RANGE && targetStructure ) {
                        attackResult = creep.attack(targetStructure);
                    }
                }

                if( attackResult == ERR_INVALID_TARGET || !targetLock )
                    delete creep.memory.target;

            }
        }
        else {
            let healResult = creep.heal(healTarget);
        }
    },

    resolveHealTarget: function( creep ) {
        
        let hurtingCreeps = creep.room.find(FIND_MY_CREEPS, {
            filter: function (creepFound) {
                return (creepFound.pos.inRangeTo(creep.pos,1) || creep.pos.isEqualTo(creepFound.pos) ) &&
                    creepFound.hits < (creepFound.hitsMax - 0);
            }
        });

        if( hurtingCreeps.length > 0 ) {
            return hurtingCreeps[0];
        }
    },

    towerDrainMode: function(creep) {

        //
        
        let hostileTowers = creep.room.find(FIND_HOSTILE_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_TOWER &&
                !diplomacy.isAlly( structure.owner.username );
            }
        });

    },

    defaultMode: function(creep) {

        if(!creep.memory.target)
            creep.heal(creep);
        
        if(creep.room.name != creep.memory.targetRoom) {
            isRemoteRoom = true;

            let result = creep.Move(new RoomPosition(25,25,creep.memory.targetRoom),{range:10,allowHostile:true,allowSK:true}); //TODO better way to determine room entry e.g. hostile position, retrieved from hostile alert saved(todo) somewhere?
            this.combatInRange( creep );
            return;
        }
            
        var target = Game.getObjectById(creep.memory.target);
        if(!target) {
            var isRemoteRoom = false;
            //first check if remote room
            if(creep.room.name != creep.memory.targetRoom) {
                isRemoteRoom = true;

                let result = creep.Move(new RoomPosition(25,25,creep.memory.targetRoom),{range:10,allowHostile:true,allowSK:true}); //TODO better way to determine room entry e.g. hostile position, retrieved from hostile alert saved(todo) somewhere?
                return;
            }
            
            if(!isRemoteRoom) {
                delete creep.memory.target;
                target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                    filter: (hostileCreep) => {
                        return !diplomacy.isAlly( hostileCreep.owner.username )
                    }
                });
                if(target && target.hits !== 0 )
                    creep.memory.target = target.id;
                else {
                    if( Memory.rooms[creep.room.name] && Memory.rooms[creep.room.name].defending )
                        delete Memory.rooms[creep.room.name].defending;
                }
            }
            
            if(!target) {
                delete creep.memory.target;
                target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                    filter: (hostileStructure) => {
                        return !diplomacy.isAlly( hostileStructure.owner.username )
                    }
                });
                if(target && target.structureType != STRUCTURE_CONTROLLER)
                    creep.memory.target = target.id;
            }
            
        }
        
        if(target) {

            this.combatInRange( creep );
            
            creep.moveTo(target,{range:0,allowHostile:true,allowSK:true});
            
        }
        else {
            delete creep.memory.target;
            let result = creep.Move(creep.room.controller,{range:2,swampCost:1,reusePath:10,allowHostile:true,allowSK:true});
        }
    }
};

module.exports = roleAttacker;