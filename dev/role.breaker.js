var u = require('util.common');

var roleBreaker = {

    /** @param {Creep} creep **/
    run: function(creep) {

        try {

            let targetRoom = creep.memory.targetRoom;

            //Get to Destination Room first
            if(targetRoom) {
                if(targetRoom != creep.room.name) {
                    let result;
                    result = creep.Move(new RoomPosition(25,25,targetRoom),{swampCost:1,range:10});
                    return;
                }
            }

            if( creep.store.getFreeCapacity() == 0 )
                creep.drop(RESOURCE_ENERGY);

            //Move to and Dismantle targets
            let target = this.resolveDismantleTarget( creep) ;
            let result = creep.dismantle( target );
            if(result == ERR_NOT_IN_RANGE) {
                creep.Move(Game.getObjectById(creep.memory.target), {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
        catch (problem) {

            console.log(`Exception thrown: role.breaker: ${problem.name}:${problem.message} ${problem.stack}`);            
        }
    },

    /**
     * Reads single or array of creep.memory.target and returns alive target
     * @param {Creep} creep 
     * @returns {Structure | boolean}
     */
    resolveDismantleTarget: function( creep ) {

        let target = creep.memory.target;
        let resolvedTarget = false;
        
        if( !Game.getObjectById(target) && creep.room.name == creep.memory.targetRoom ) {

            let checkTarget = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);/*, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_WALL);
                }});*/

            if(checkTarget && checkTarget.structureType != STRUCTURE_CONTROLLER) {

                creep.room.target = checkTarget.id;
                resolvedTarget = Game.getObjectById(checkTarget.id);
            }
        }
        else if( target instanceof Array ) {

            for( let i = target.length - 1; i >= 0; i-- ) {

                let checkTarget = target.pop(); // this doesn't modify original list of targets yet, see below.
                let verifyTarget = Game.getObjectById( checkTarget );

                if( verifyTarget ) {

                    resolvedTarget = verifyTarget;
                    break;
                }
                else {

                    creep.memory.target.pop(); // remove saved target that is no longer valid
                }
            }
        }
        else
            resolvedTarget = Game.getObjectById(target);         

        return resolvedTarget;
    }
};

module.exports = roleBreaker;