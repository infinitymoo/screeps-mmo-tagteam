var taskCommon = require('task.common');

var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleTransport = require('role.transport');
var roleRepairer = require('role.repairer');
var roleAttacker = require('role.attacker');
var roleRefiller = require('role.refiller');
var roleClaimer = require('role.claimer');
var roleBreaker = require('role.breaker');

var creepCommon = {

    run() {
    
        for(var name in Game.creeps) {
            var creep = Game.creeps[name];
    
            try {
                if(!creep.spawning) {

                    if(creep.memory.class = 'worker') {
                        this.doJob(creep);                        
                    }
                    // if(creep.memory.role == 'upgrader') {
                    //     roleUpgrader.run(creep);
                    // }
                    // if(creep.memory.role == 'builder') {
                    //     roleBuilder.run(creep);
                    // }
                    // if(creep.memory.role == 'repairer') {
                    //     roleRepairer.run(creep);
                    // }
                
                    if(creep.memory.role == 'harvester') {
                        roleHarvester.run(creep);
                    }
                    if(creep.memory.role == 'transport') {
                        roleTransport.run(creep);
                    }
                    if(creep.memory.role == 'attacker') {
                        roleAttacker.run(creep);
                    }
                    if(creep.memory.role == 'refiller') {
                        roleRefiller.run(creep);
                    }
                    if(creep.memory.role == 'claimer') {
                        roleClaimer.run(creep);
                    }
                    if(creep.memory.role == 'breaker') {
                        roleBreaker.run(creep);
                    }
                }
            }
            catch( problem ) {
                console.log(`E creepCommon.run(): ${problem.name}: ${problem.message} ${problem.stack}`);
            }

        }
    },

    doJob(creep) {
        //initialization
        let completedTasks = [];
        let taskList = creep.memory.taskList;
        let taskData = creep.memory.taskData;

        //validation
        if(!taskList) creep.memory.taskList = [];
        if(!taskData) creep.memory.taskData = {};

        //execution
        let continueState = true;
        while( continueState ) {
            continueState = this.stateProcessStack(creep,taskList,taskData);
        }

        //update state
    },
    
    stateProcessPositioning(creep,taskList,taskData) {
        let targetPosition = creep.memory.target;
        if(!this.isInPositionAtTarget(creep) ) {
            creep.travelTo(targetPosition);
        }
    },

    isInPositionAtTarget(creep) {

    },
    
    stateProcessStack(creep,taskList,taskData,taskComplete = false) {
        let currentTask = taskList.pop();
        let currentData = taskData.pop();
        
        this.stateProcessPositioning(creep,taskList,taskData);
        this.stateProcessTask(creep,taskList,taskData);

        let taskCompleted = taskCommon[currentTask](creep,taskData);
        if( taskCompleted )
            this.stateProcessStack(creep,taskList,taskData,currentTask);
        

    },

    /**
     * Evaluates state of creep and determines if it should switch modes
     * @param {Creep} creep 
     */
    checkTransition: function(creep) {
        // if empty, switch to sourcing mode
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('🧊');
        }
        // if it has energy, go work, unless its busy filling up with harvesting
        else if( !creep.memory.working && (!creep.memory.hasHarvested || creep.memory.hasHarvested == 0) && creep.store[RESOURCE_ENERGY] != 0 ){
            creep.memory.working = true;
            creep.say('⚡'); 
        }
    },

    doUpgrade(creep) {
        taskCommon.upgradeController(creep);
    }

}

module.exports = creepCommon;