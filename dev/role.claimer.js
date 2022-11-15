var roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            var targetRoom = creep.memory.targetRoom;
            if(targetRoom) {
                var result;
                var controller;
                var roomObject = Game.rooms[targetRoom];

                if(roomObject) {
                    controller = roomObject.controller;
                }
                // if can't see room, assume its because we're blind to it
                else {
                    result = creep.Move(new RoomPosition(25,25,targetRoom),{swampCost:1,range:1});
                    return;
                }

                //sometimes we can see the room we must go to but we're not there yet
                if(targetRoom != creep.room.name) {
                    var result;
                    if(controller)
                        result = creep.Move(controller);
                    else // just in case but probably never called
                        result = creep.Move(new RoomPosition(25,25,targetRoom),{ignorecreeps:true,swampCost:1,range:1});
                    return;
                }
                else {
                    if(controller) {
                        let result;
                        if( creep.memory.mode == 'attack' || (creep.room.controller.reservation && creep.room.controller.reservation.username == 'Invader'))
                            result = creep.attackController(controller);
                        else
                            result = creep.reserveController(controller);
                        
                        if(result == ERR_NOT_IN_RANGE) {
                            creep.Move(controller, {ignoreCreeps: false,range:1});
                        }
                        else if( result == OK && creep.memory.mode == 'attack' ) {
                            this.setAttackCooldown( controller );
                            delete creep.memory.targetRoom;
                            this.getNewTargetRoom( creep );
                        }
                    }
                    else
                        throw "claimer in room "+targetRoom+" but can't see controller";
                }
            }
        }
        catch (problem) {
            console.log('claimer threw error: '+problem);
        }
    },

    setAttackCooldown( controller ) {

        if(!Memory.attackController) {
            Memory.attackController = [];
        }

        if( !Memory.attackController[controller.room.name])
            Memory.attackController[controller.room.name] = Game.time + 1000;
    },

    getNewTargetRoom( creep ) {

        if(Memory.attackController && Memory.attackController.length > 0) {
            _.forEach( Memory.attackController, (cooldown,targetRoom) => {
                if( cooldown >= Game.time ) {
                    creep.memory.targetRoom = targetRoom;
                }
            } )
        }
    },

    getRecycled( creep ) {
        
    }
};

module.exports = roleClaimer;