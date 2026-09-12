	.file	1 "t07_struct.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	get_field
	.align	2
	.globl	get_c
	.align	2
	.globl	get_uc
	.align	2
	.globl	get_s
	.align	2
	.globl	get_arr2
	.align	2
	.globl	get_next_value
	.align	2
	.globl	set_all
	.align	2
	.globl	copy_foo
	.align	2
	.globl	make_small
	.align	2
	.globl	sum_small
	.align	2
	.globl	walk

	.text
	.text
	.ent	get_field
get_field:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lw	$2,0($4)
	j	$31
	.end	get_field
	.text
	.ent	get_c
get_c:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lbu	$2,6($4)
	j	$31
	.end	get_c
	.text
	.ent	get_uc
get_uc:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lbu	$2,7($4)
	j	$31
	.end	get_uc
	.text
	.ent	get_s
get_s:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lh	$2,4($4)
	j	$31
	.end	get_s
	.text
	.ent	get_arr2
get_arr2:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lw	$2,16($4)
	j	$31
	.end	get_arr2
	.text
	.ent	get_next_value
get_next_value:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lw	$2,20($4)
	#nop
	lw	$2,20($2)
	#nop
	lw	$2,0($2)
	j	$31
	.end	get_next_value
	.text
	.ent	set_all
set_all:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sw	$5,0($4)
	sh	$5,4($4)
	sb	$5,6($4)
	.set	noreorder
	.set	nomacro
	j	$31
	sw	$5,8($4)
	.set	macro
	.set	reorder

	.end	set_all
	.text
	.ent	copy_foo
copy_foo:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lw	$2,0($5)
	lw	$3,4($5)
	lw	$6,8($5)
	lw	$7,12($5)
	sw	$2,0($4)
	sw	$3,4($4)
	sw	$6,8($4)
	sw	$7,12($4)
	lw	$2,16($5)
	lw	$3,20($5)
	sw	$2,16($4)
	.set	noreorder
	.set	nomacro
	j	$31
	sw	$3,20($4)
	.set	macro
	.set	reorder

	.end	copy_foo
	.text
	.ent	make_small
make_small:
	.frame	$sp,8,$31		# vars= 8, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	subu	$sp,$sp,8
	move	$2,$4
	sh	$5,0($sp)
	sh	$6,2($sp)
	lwl	$3,3($sp)
	lwr	$3,0($sp)
	swl	$3,3($2)
	swr	$3,0($2)
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,8
	.set	macro
	.set	reorder

	.end	make_small
	.text
	.ent	sum_small
sum_small:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sw	$4,0($sp)
	lh	$3,0($sp)
	lh	$2,2($sp)
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$3,$2
	.set	macro
	.set	reorder

	.end	sum_small
	.text
	.ent	walk
walk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	beq	$4,$0,$L13
	move	$3,$0
	.set	macro
	.set	reorder

$L14:
	lw	$2,0($4)
	lw	$4,20($4)
	#nop
	.set	noreorder
	.set	nomacro
	bne	$4,$0,$L14
	addu	$3,$3,$2
	.set	macro
	.set	reorder

$L13:
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$3
	.set	macro
	.set	reorder

	.end	walk
